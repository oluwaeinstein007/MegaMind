import { config } from "../lib/config.js";

export const visaService = {
	getVisaInfoByCountry: async (
		countryCode: string,
		currencyCode?: string,
	): Promise<any> => {
		let url = `${config.visaApi.baseUrl}/visa/country/details/${countryCode}`;
		if (currencyCode) {
			url += `?currencyCode=${currencyCode}`;
		}
		try {
			const response = await fetch(url, {
				headers: {
					"x-api-key": config.visaApi.apiKey,
				},
			});
			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}
			const rawData = await response.json();

			// Transform the raw data into the expected structure
			const formattedData = {
				data: {
					visaCountry: rawData.data?.visaCountry || null, // Assuming rawData.data.visaCountry contains the country details
					visaNews: rawData.data?.visaNews || [],
					visaFaq: rawData.data?.visaFaq || [],
					visaTypes: rawData.data?.visaTypes || [],
					bookingsCount: rawData.data?.bookingsCount || 0,
				},
			};
			return formattedData;
		} catch (error) {
			console.error("Error fetching visa info:", error);
			throw error;
		}
	},
};
