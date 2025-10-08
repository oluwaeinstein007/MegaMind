import { config } from "../lib/config.js";

export const immigrationService = {
	getImmigrationInfoByCountry: async (countryCode: string): Promise<any> => {
		const url = `${config.immigrationApi.baseUrl}/immigration/service/country/${countryCode}?per_page=100`;
		try {
			const response = await fetch(url, {
				headers: {
					"x-api-key": config.immigrationApi.apiKey,
				},
			});
			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}
			const data = await response.json();
			return data;
		} catch (error) {
			console.error("Error fetching immigration info:", error);
			throw error;
		}
	},
};
