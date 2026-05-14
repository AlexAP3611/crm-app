import logging
from typing import List, Dict, Any, Literal, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.exc import IntegrityError

from app.core.importer.schema import PipelineResult, RowResult, IngestionSummary, IngestionError
from app.core.importer.cache import extract_identifiers, prefetch_empresas, IdentityCache
from app.core.importer.registry import EMPRESA_REGISTRY, CONTACT_REGISTRY
from app.core.importer.resolver import CanonicalResolver
from app.core.importer.sanitizer import StatelessSanitizer
from app.core.importer.validator import BusinessInterrogator
from app.schemas.empresa import EmpresaCreate
from app.schemas.contact import ContactCreate
from app.services import (
    empresa_service, sector_service, vertical_service, product_service,
    contact_service, cargo_service, campaign_service,
    pais_service, provincia_service
)
from app.core.utils import normalize_web, normalize_company_name
from app.models import Sector, Vertical, Product, Contact, Cargo, Campaign

logger = logging.getLogger(__name__)

class PipelineCoordinator:
    def __init__(self, session: AsyncSession, mode: Literal["preview", "commit"] = "preview"):
        self.session = session
        self.mode = mode
        self.resolver = CanonicalResolver(EMPRESA_REGISTRY)
        self.sanitizer = StatelessSanitizer()
        
    def _consolidate_rows(self, raw_rows: List[Dict[str, Any]]) -> Tuple[List[Dict[str, Any]], List[RowResult]]:
        """
        Groups rows by identity (CIF, Web, or Name) to avoid multiple upserts for the same entity.
        Returns (consolidated_rows, pre_results)
        """
        consolidated = {} # master_idx -> sanitized_row
        pre_results = []
        
        # Identity trackers: value -> master_row_idx
        cif_map = {}
        web_map = {}
        name_map = {}
        
        for idx, row in enumerate(raw_rows):
            # 1. Resolve canonical names first to get identity fields
            canonical, _ = self.resolver.resolve_row(row)
            sanitized = self.sanitizer.sanitize_row(canonical)
            
            cif = sanitized.get("cif")
            web = normalize_web(sanitized.get("web")) if sanitized.get("web") else None
            name = normalize_company_name(sanitized.get("nombre")) if sanitized.get("nombre") else None
            
            # 2. Validation: Minimal Identity Check
            if not any([cif, web, name]):
                pre_results.append(RowResult(
                    row_idx=idx, status="error", 
                    errors=[IngestionError(code="MISSING_IDENTITY", message="Fila sin identificadores mínimos (CIF, Web o Nombre vacíos)", severity="CRITICAL")]
                ))
                continue

            # 3. Find Master Row for merging
            master_idx = None
            reason = None
            if cif and cif in cif_map:
                master_idx = cif_map[cif]
                reason = "CIF"
            elif web and web in web_map:
                master_idx = web_map[web]
                reason = "Web"
            elif name and name in name_map:
                master_idx = name_map[name]
                reason = "Nombre"
            
            if master_idx is not None:
                # Merge into master row
                existing = consolidated[master_idx]
                for field in ["sector_name", "vertical_name", "product_name"]:
                    if field in sanitized:
                        val = sanitized[field]
                        if val:
                            if field not in existing: existing[field] = set()
                            # Handle string, int or existing sets
                            if isinstance(existing[field], (str, int)): existing[field] = {existing[field]}
                            existing[field].add(val)
                
                # Merge other fields (only if not already set in master)
                for k, v in sanitized.items():
                    if k not in ["sector_name", "vertical_name", "product_name"] and not existing.get(k):
                        existing[k] = v

                # Report merge
                pre_results.append(RowResult(
                    row_idx=idx, status="success", action="merged",
                    warnings=[IngestionError(code="ROW_CONSOLIDATED", message=f"Fila fusionada con la Línea Excel {master_idx + 2} por coincidencia de {reason}", severity="INFO")]
                ))
            else:
                # New master row
                master_idx = idx
                # Convert potential string/list fields to sets for merging
                for field in ["sector_name", "vertical_name", "product_name"]:
                    if field in sanitized:
                        val = sanitized[field]
                        if val:
                            sanitized[field] = {val} if not isinstance(val, (list, set)) else set(val)
                        else:
                            sanitized[field] = set()
                    else:
                        sanitized[field] = set()
                
                consolidated[master_idx] = sanitized
                if cif: cif_map[cif] = master_idx
                if web: web_map[web] = master_idx
                if name: name_map[name] = master_idx
        
        # Convert sets back to lists for the rest of the pipeline
        final_list = []
        for master_idx, row in consolidated.items():
            row["_master_idx"] = master_idx
            for field in ["sector_name", "vertical_name", "product_name"]:
                if field in row and isinstance(row[field], set):
                    row[field] = list(row[field])
            final_list.append(row)

        return final_list, pre_results

    async def _process_row_logic(
        self, 
        idx: int, 
        row: Dict[str, Any], 
        cache: IdentityCache,
        sector_cache: Dict[str, Any],
        vertical_cache: Dict[str, Any],
        product_cache: Dict[str, Any],
        interrogator: BusinessInterrogator,
        pais_cache: Dict[str, Any],
        provincia_cache: Dict[str, Any],
    ) -> RowResult:
        all_issues = interrogator.validate_empresa(row)

        # row_warnings se inicializa SIEMPRE aquí, antes de cualquier bloque condicional,
        # para que los warnings de ubicación se puedan acumular incluso cuando también
        # existen otros warnings de validación previos.
        row_errors = [e for e in all_issues if e.severity in ["BLOCKER", "CRITICAL"]]
        row_warnings = [e for e in all_issues if e.severity in ["WARNING", "INFO"]]

        if row_errors:
            return RowResult(row_idx=idx, status="error", errors=row_errors, warnings=row_warnings)

        # Layer 4a: Resolve Pais — lookup estricto, sin crear registros nuevos
        pais_name = row.get("pais")
        pais_id = None
        # Determinar si la empresa ya existe para contextualizar los warnings
        is_existing = cache.get_by_identity(cif=row.get("cif"), web=row.get("web"), name=row.get("nombre")) is not None
        if pais_name:
            cache_key = pais_name.strip().lower()
            if cache_key in pais_cache:
                pais_id = pais_cache[cache_key]  # None si fue un cache miss previo
                if pais_id is None:
                    # Miss ya cacheado: re-emitir warning para ESTA fila
                    pais_msg = (f"País '{pais_name}' no encontrado en la base de datos. El campo país no se actualizará."
                                if is_existing else
                                f"País '{pais_name}' no encontrado en la base de datos. La empresa se creará sin país asignado.")
                    row_warnings.append(IngestionError(
                        code="PAIS_NOT_FOUND",
                        message=pais_msg,
                        field="pais",
                        severity="WARNING"
                    ))
            else:
                pais_obj = await pais_service.get_by_name(self.session, pais_name)
                if pais_obj:
                    pais_id = pais_obj.id
                    pais_cache[cache_key] = pais_id
                else:
                    # No match → cachear el miss y emitir WARNING no bloqueante
                    pais_cache[cache_key] = None
                    pais_msg = (f"País '{pais_name}' no encontrado en la base de datos. El campo país no se actualizará."
                                if is_existing else
                                f"País '{pais_name}' no encontrado en la base de datos. La empresa se creará sin país asignado.")
                    row_warnings.append(IngestionError(
                        code="PAIS_NOT_FOUND",
                        message=pais_msg,
                        field="pais",
                        severity="WARNING"
                    ))

        # Layer 4b: Resolve Provincia — lookup estricto, requiere pais_id válido
        provincia_name = row.get("provincia")
        provincia_id = None
        if provincia_name:
            if not pais_id:
                # Provincia no resoluble sin país válido (país ausente en CSV o no encontrado)
                if pais_name:
                    prov_msg = (f"Provincia '{provincia_name}' no se puede resolver porque el país '{pais_name}' no fue encontrado. El campo provincia no se actualizará."
                                if is_existing else
                                f"Provincia '{provincia_name}' no se puede resolver porque el país '{pais_name}' no fue encontrado. La empresa se creará sin provincia asignada.")
                    row_warnings.append(IngestionError(
                        code="PROVINCIA_NO_PAIS",
                        message=prov_msg,
                        field="provincia",
                        severity="WARNING"
                    ))
                # Si no había pais_name en el CSV, silencio: no hay nada que resolver
            else:
                prov_key = f"{pais_id}:{provincia_name.strip().lower()}"
                if prov_key in provincia_cache:
                    provincia_id = provincia_cache[prov_key]  # None si fue un cache miss previo
                    if provincia_id is None:
                        # Miss ya cacheado: re-emitir warning para ESTA fila
                        prov_msg = (f"Provincia '{provincia_name}' no encontrada para el país seleccionado. El campo provincia no se actualizará."
                                    if is_existing else
                                    f"Provincia '{provincia_name}' no encontrada para el país seleccionado. La empresa se creará sin provincia asignada.")
                        row_warnings.append(IngestionError(
                            code="PROVINCIA_NOT_FOUND",
                            message=prov_msg,
                            field="provincia",
                            severity="WARNING"
                        ))
                else:
                    prov_obj = await provincia_service.get_by_name_and_pais(self.session, provincia_name, pais_id)
                    if prov_obj:
                        provincia_id = prov_obj.id
                        provincia_cache[prov_key] = provincia_id
                    else:
                        # No match → cachear el miss y emitir WARNING no bloqueante
                        provincia_cache[prov_key] = None
                        prov_msg = (f"Provincia '{provincia_name}' no encontrada para el país seleccionado. El campo provincia no se actualizará."
                                    if is_existing else
                                    f"Provincia '{provincia_name}' no encontrada para el país seleccionado. La empresa se creará sin provincia asignada.")
                        row_warnings.append(IngestionError(
                            code="PROVINCIA_NOT_FOUND",
                            message=prov_msg,
                            field="provincia",
                            severity="WARNING"
                        ))

        # Layer 4c: M2M Resolution
        resolved_sectors = []
        for s_name in row.get("sector_name", []):
            s = await sector_service.get_or_create(self.session, s_name, cache=sector_cache)
            if s: resolved_sectors.append(s)
        
        resolved_verticals = []
        for v_name in row.get("vertical_name", []):
            v = await vertical_service.get_or_create(self.session, v_name, cache=vertical_cache)
            if v: resolved_verticals.append(v)
            
        resolved_products = []
        for p_name in row.get("product_name", []):
            p = await product_service.get_or_create(self.session, p_name, cache=product_cache)
            if p: resolved_products.append(p)

        # Layer 5: Domain Persistence
        if self.mode == "preview":
            existing = cache.get_by_identity(cif=row.get("cif"), web=row.get("web"), name=row.get("nombre"))
            action = "updated" if existing else "created"
            return RowResult(
                row_idx=idx, status="success", action=action,
                warnings=row_warnings, entity_id=existing.id if existing else None
            )
        else:
            payload = {k: v for k, v in row.items() if k in EmpresaCreate.model_fields and k not in ["sector_ids", "vertical_ids", "product_ids", "pais", "provincia"]}
            # Inyectar FKs resueltos (solo si tienen valor; NULL si no hubo match)
            if pais_id:
                payload["pais_id"] = pais_id
            if provincia_id:
                payload["provincia_id"] = provincia_id
            empresa_data = EmpresaCreate(**payload)
            
            empresa, action = await empresa_service.upsert_empresa(self.session, empresa_data)
            
            if resolved_sectors: empresa.sectors = resolved_sectors
            if resolved_verticals: empresa.verticals = resolved_verticals
            if resolved_products: empresa.products_rel = resolved_products
            
            return RowResult(
                row_idx=idx, status="success", action=action,
                warnings=row_warnings, entity_id=empresa.id
            )

    async def ingest_empresas(self, raw_rows: List[Dict[str, Any]]) -> PipelineResult:
        consolidated_rows, pre_results = self._consolidate_rows(raw_rows)
        
        results: List[RowResult] = pre_results
        summary = IngestionSummary(total=len(raw_rows))
        
        for res in pre_results:
            if res.status == "error": summary.failed += 1
            elif res.action == "merged": summary.merged += 1
        
        identifiers = extract_identifiers(consolidated_rows)
        cache = await prefetch_empresas(self.session, identifiers)
        
        all_sectors, all_verticals, all_products = set(), set(), set()
        for row in consolidated_rows:
            all_sectors.update(row.get("sector_name", []))
            all_verticals.update(row.get("vertical_name", []))
            all_products.update(row.get("product_name", []))
            
        sector_cache = await sector_service.prefill_sector_cache(self.session, all_sectors)
        vertical_cache = await vertical_service.prefill_vertical_cache(self.session, all_verticals)
        product_cache = await product_service.prefill_product_cache(self.session, all_products)
        
        interrogator = BusinessInterrogator(cache)
        
        # ── Batch prefetch de ubicación (elimina N+1 queries) ──
        # Paso 1: Recoger todos los nombres únicos de país y provincia
        all_pais_names: set[str] = set()
        all_provincia_by_row: list[tuple[str, str]] = []  # (pais_name, provincia_name)
        for row in consolidated_rows:
            p = row.get("pais")
            if p and isinstance(p, str) and p.strip():
                all_pais_names.add(p.strip())
            prov = row.get("provincia")
            if prov and isinstance(prov, str) and prov.strip() and p:
                all_provincia_by_row.append((p.strip(), prov.strip()))

        # Paso 2: Batch fetch países → {lower_name: Pais}
        pais_cache: Dict[str, Any] = {}  # lower_name → pais_id | None
        if all_pais_names:
            pais_prefill = await pais_service.prefill_cache(self.session, all_pais_names)
            for name in all_pais_names:
                key = name.lower()
                if key in pais_prefill:
                    pais_cache[key] = pais_prefill[key].id
                else:
                    pais_cache[key] = None  # Pre-cachear el miss

        # Paso 3: Batch fetch provincias agrupadas por pais_id resuelto
        provincia_cache: Dict[str, Any] = {}  # "pais_id:lower_name" → provincia_id | None
        prov_by_pais: Dict[int, set[str]] = {}
        for pais_name_raw, prov_name_raw in all_provincia_by_row:
            resolved_pais_id = pais_cache.get(pais_name_raw.lower())
            if resolved_pais_id:  # Solo si el país se resolvió
                prov_by_pais.setdefault(resolved_pais_id, set()).add(prov_name_raw)

        for pid, prov_names in prov_by_pais.items():
            prov_prefill = await provincia_service.prefill_cache(self.session, prov_names, pid)
            for name in prov_names:
                prov_key = f"{pid}:{name.lower()}"
                if name.lower() in prov_prefill:
                    provincia_cache[prov_key] = prov_prefill[name.lower()].id
                else:
                    provincia_cache[prov_key] = None  # Pre-cachear el miss
        
        for row in consolidated_rows:
            idx = row.pop("_master_idx")
            try:
                if self.mode == "commit":
                    async with self.session.begin_nested():
                        result = await self._process_row_logic(idx, row, cache, sector_cache, vertical_cache, product_cache, interrogator, pais_cache, provincia_cache)
                        if result.status == "success":
                            await self.session.flush()
                            summary.success += 1
                            # Contar warnings de ubicación para el resumen
                            for w in result.warnings:
                                if w.code == "PAIS_NOT_FOUND":
                                    summary.warnings_pais += 1
                                elif w.code in ("PROVINCIA_NOT_FOUND", "PROVINCIA_NO_PAIS"):
                                    summary.warnings_provincia += 1
                        else:
                            summary.failed += 1
                        results.append(result)
                else:
                    result = await self._process_row_logic(idx, row, cache, sector_cache, vertical_cache, product_cache, interrogator, pais_cache, provincia_cache)
                    if result.status == "success":
                        summary.success += 1
                        # Contar warnings de ubicación para el resumen
                        for w in result.warnings:
                            if w.code == "PAIS_NOT_FOUND":
                                summary.warnings_pais += 1
                            elif w.code in ("PROVINCIA_NOT_FOUND", "PROVINCIA_NO_PAIS"):
                                summary.warnings_provincia += 1
                    else:
                        summary.failed += 1
                    results.append(result)

            except Exception as e:
                logger.exception(f"Unexpected error in row {idx}")
                if self.mode == "commit": self.session.expunge_all()
                
                error_msg = str(e)
                if isinstance(e, IntegrityError):
                    db_error = str(e.orig) if hasattr(e, 'orig') else str(e)
                    error_msg = f"Error de integridad en base de datos: {db_error}"
                    clashing_entity = cache.get_by_identity(cif=row.get("cif"), web=row.get("web"), name=row.get("nombre"))
                    if clashing_entity:
                        error_msg += f". Contexto: Los datos parecen pertenecer ya a la empresa '{clashing_entity.nombre}' (ID: {clashing_entity.id})."
                
                summary.failed += 1
                results.append(RowResult(row_idx=idx, status="error", errors=[IngestionError(code="UNEXPECTED_ERROR", message=error_msg, severity="CRITICAL")]))

        if self.mode == "commit" and summary.success > 0: await self.session.commit()
        elif self.mode == "commit": await self.session.rollback()

        results.sort(key=lambda x: x.row_idx)
        return PipelineResult(summary=summary, results=results)

class ContactCoordinator:
    def __init__(self, session: AsyncSession, mode: Literal["preview", "commit"] = "preview"):
        self.session = session
        self.mode = mode
        self.resolver = CanonicalResolver(CONTACT_REGISTRY)
        self.sanitizer = StatelessSanitizer()

    def _consolidate_rows(self, raw_rows: List[Dict[str, Any]]) -> Tuple[List[Dict[str, Any]], List[RowResult]]:
        """
        Groups rows by Email to avoid duplicates in the same file.
        """
        consolidated = {} # email -> sanitized_row
        pre_results = []
        email_map = {} # email -> master_idx

        for idx, row in enumerate(raw_rows):
            canonical, _ = self.resolver.resolve_row(row)
            sanitized = self.sanitizer.sanitize_row(canonical)
            
            email = sanitized.get("email", "").lower().strip()
            
            if not email:
                # Contacts MUST have at least an email for consolidation in this pipeline
                # (IdentityCache could handle phone/linkedin too, but for consolidation email is safest)
                # Actually, let's check for any identifier
                phone = sanitized.get("phone")
                linkedin = sanitized.get("linkedin")
                if not any([email, phone, linkedin]):
                    pre_results.append(RowResult(
                        row_idx=idx, status="error", 
                        errors=[IngestionError(code="MISSING_IDENTITY", message="Contacto sin Email, Teléfono ni LinkedIn", severity="CRITICAL")]
                    ))
                    continue
                # If no email but has phone/linkedin, we use those as key? 
                # For simplicity, if no email, we don't consolidate or we use a fake key
                key = f"no-email-{idx}"
            else:
                key = email

            if key in email_map:
                master_idx = email_map[key]
                existing = consolidated[master_idx]
                # Merge fields
                for k, v in sanitized.items():
                    if not existing.get(k) and v:
                        existing[k] = v
                
                pre_results.append(RowResult(
                    row_idx=idx, status="success", action="merged",
                    warnings=[IngestionError(code="ROW_CONSOLIDATED", message=f"Fila fusionada con la Línea Excel {master_idx + 2} por duplicidad de email", severity="INFO")]
                ))
            else:
                master_idx = idx
                consolidated[master_idx] = sanitized
                email_map[key] = master_idx

        final_list = []
        for master_idx, row in consolidated.items():
            row["_master_idx"] = master_idx
            final_list.append(row)

        return final_list, pre_results

    async def _process_row_logic(
        self, 
        idx: int, 
        row: Dict[str, Any],
        cargo_cache: Dict[str, Any],
        campaign_cache: Dict[str, Any],
        empresa_cache: Dict[str, Any]
    ) -> RowResult:
        warnings = []
        
        # 1. Resolve Empresa (by name only, cached)
        empresa_id = None
        emp_name = row.get("empresa_nombre")
        if emp_name:
            norm_name = normalize_company_name(emp_name).lower()
            if norm_name in empresa_cache:
                empresa_id, was_created = empresa_cache[norm_name]
            else:
                resolution = await empresa_service.resolve_empresa(
                    self.session, 
                    empresa_nombre=emp_name, 
                    auto_create=(self.mode == "commit")
                )
                if resolution:
                    empresa_id = resolution.empresa.id
                    was_created = resolution.created
                    empresa_cache[norm_name] = (empresa_id, was_created)
                    if was_created:
                        warnings.append(IngestionError(code="AUTO_EMPRESA", message=f"Se ha creado automáticamente la empresa '{emp_name}'", severity="INFO"))
                elif self.mode == "preview":
                    # In preview, we signal it would be created
                    empresa_cache[norm_name] = (None, True)
                    warnings.append(IngestionError(code="AUTO_EMPRESA", message=f"Se crearía la empresa '{emp_name}'", severity="INFO"))

        # 2. Resolve Cargo
        cargo_id = None
        cargo_name = row.get("job_title")
        if cargo_name:
            if self.mode == "commit":
                cargo_obj = await cargo_service.get_or_create_cargo(self.session, cargo_name, cache=cargo_cache)
                if cargo_obj: cargo_id = cargo_obj.id
            else:
                norm_cargo = cargo_service.normalize_cargo_name(cargo_name)
                if norm_cargo and norm_cargo not in cargo_cache:
                    cargo_cache[norm_cargo] = True
                    warnings.append(IngestionError(code="AUTO_CARGO", message=f"Se detectó cargo nuevo: {cargo_name}", severity="INFO"))

        # 3. Resolve Campaign
        campaign_ids = []
        campaign_name = row.get("campaña")
        if campaign_name:
            norm_camp = campaign_service.normalize_name(campaign_name).lower()
            if self.mode == "commit":
                campaign_obj = await campaign_service.get_or_create(self.session, campaign_name)
                if campaign_obj: 
                    campaign_ids = [campaign_obj.id]
                    if norm_camp not in campaign_cache:
                        campaign_cache[norm_camp] = True
            else:
                if norm_camp not in campaign_cache:
                    existing = await campaign_service.get_by_name(self.session, campaign_name)
                    if not existing:
                        warnings.append(IngestionError(code="AUTO_CAMPAIGN", message=f"Se crearía la campaña: {campaign_name}", severity="INFO"))
                    campaign_cache[norm_camp] = True

        # 4. Domain Persistence
        payload = {k: v for k, v in row.items() if k in ContactCreate.model_fields}
        if empresa_id: payload["empresa_id"] = empresa_id
        if cargo_id: payload["cargo_id"] = cargo_id
        
        data = ContactCreate(**payload, campaign_ids=campaign_ids, merge_lists=True)

        if self.mode == "preview":
            existing = await contact_service.resolve_contact(self.session, data)
            action = "updated" if existing else "created"
            return RowResult(row_idx=idx, status="success", action=action, warnings=warnings)
        else:
            contact, action = await contact_service.upsert_contact(self.session, data, auto_commit=False)
            return RowResult(row_idx=idx, status="success", action=action, warnings=warnings, entity_id=contact.id)

    async def ingest_contacts(self, raw_rows: List[Dict[str, Any]]) -> PipelineResult:
        consolidated_rows, pre_results = self._consolidate_rows(raw_rows)
        
        results: List[RowResult] = pre_results
        summary = IngestionSummary(total=len(raw_rows))
        
        for res in pre_results:
            if res.status == "error": summary.failed += 1
            elif res.action == "merged": summary.merged += 1

        # Caches
        cargo_cache = {}
        campaign_cache = {}
        empresa_cache = {} # norm_name -> (id, was_created)

        for row in consolidated_rows:
            idx = row.pop("_master_idx")
            try:
                if self.mode == "commit":
                    async with self.session.begin_nested():
                        result = await self._process_row_logic(idx, row, cargo_cache, campaign_cache, empresa_cache)
                        if result.status == "success":
                            await self.session.flush()
                            summary.success += 1
                        else:
                            summary.failed += 1
                        results.append(result)
                else:
                    result = await self._process_row_logic(idx, row, cargo_cache, campaign_cache, empresa_cache)
                    if result.status == "success": summary.success += 1
                    else: summary.failed += 1
                    results.append(result)

            except Exception as e:
                logger.exception(f"Unexpected error in row {idx}")
                if self.mode == "commit": self.session.expunge_all()
                summary.failed += 1
                results.append(RowResult(row_idx=idx, status="error", errors=[IngestionError(code="UNEXPECTED_ERROR", message=str(e), severity="CRITICAL")]))

        if self.mode == "commit" and summary.success > 0: await self.session.commit()
        elif self.mode == "commit": await self.session.rollback()

        results.sort(key=lambda x: x.row_idx)
        return PipelineResult(summary=summary, results=results)
