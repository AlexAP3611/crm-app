import { api } from './client'

let cache = null

export const normalizeConfig = (value) => {
    if (!value) return {}
    if (typeof value === 'string') {
        try {
            return JSON.parse(value)
        } catch {
            return {}
        }
    }
    return value
}

export const settingsService = {
    /**
     * Obtiene las configuraciones externas, utilizando la caché si está disponible.
     * @param {boolean} forceRefresh Si es true, ignora la caché y consulta al backend.
     */
    getExternalConfigs: async (forceRefresh = false) => {
        if (cache && !forceRefresh) {
            return cache
        }

        try {
            const data = await api.getSettingsByPrefix('ext_config_')
            const configs = {}
            data.forEach((item) => {
                const svcId = item.key.replace('ext_config_', '')
                configs[svcId] = normalizeConfig(item.value)
            })
            cache = configs
            return cache
        } catch (err) {
            console.error('Error in settingsService.getExternalConfigs:', err)
            throw err
        }
    },

    /**
     * Invalida la caché y fuerza una nueva carga del backend.
     */
    refreshSettings: async () => {
        return await settingsService.getExternalConfigs(true)
    }
}
