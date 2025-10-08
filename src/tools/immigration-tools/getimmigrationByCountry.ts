import dedent from "dedent";
import { z } from "zod";
import { immigrationService } from "../../services/immigrationService.js";

const getImmigrationCountryParam = z.object({
	countryCode: z
		.string()
		.describe("The ISO 3166-1 alpha-2 country code (e.g., 'US', 'GB')."),
});

type getImmigrationCountryParam = z.infer<typeof getImmigrationCountryParam>;

export const getImmigrationInfoByCountry = {
	name: "GET_IMMIGRATION_INFO_BY_COUNTRY",
	description: "Get immigration information for a specific country.",
	parameters: getImmigrationCountryParam,
	execute: async (params: getImmigrationCountryParam) => {
		try {
			const immigrationInfo =
				await immigrationService.getImmigrationInfoByCountry(
					params.countryCode,
				);

			let formattedImmigrationInfo = `💼 Immigration information for ${params.countryCode}:\n`;

			if (
				immigrationInfo && immigrationInfo.data && Array.isArray(immigrationInfo.data.data)
			) {
				if (immigrationInfo.data.data.length > 0) {
					immigrationInfo.data.data.forEach((service:any) => {
					  formattedImmigrationInfo += `\n🏛️ Service: ${service.name || "N/A"}`;
					  formattedImmigrationInfo += `\n📄 Description: ${service.description || "N/A"}`;
					  formattedImmigrationInfo += `\n💬 Consultation Note: ${service.consultation_note || "N/A"}`;
					  
					  if (Array.isArray(service.countries) && service.countries.length > 0) {
						// Iterate through each country for this service
						service.countries.forEach((country:any) => {
						  formattedImmigrationInfo += `\n🌍 Country: ${country.country_code || "N/A"}`;
						  formattedImmigrationInfo += `\n💰 Consultation Fee: $${country.consultation_fee || "N/A"}`;
						  formattedImmigrationInfo += `\n💰 Service Fee: $${country.service_fee || "N/A"}`;
						  
						  if (Array.isArray(country.requirements) && country.requirements.length > 0) {
							formattedImmigrationInfo += "\n✅ Requirements:";
							country.requirements.forEach((req:any) => {
							  formattedImmigrationInfo += `\n  - ${req.requirement || "N/A"} (${req.response_type || "N/A"})`;
							});
						  } else {
							formattedImmigrationInfo += "\nNo specific requirements listed for this country.";
						  }
						  formattedImmigrationInfo += "\n"; // Add spacing between countries
						});
					  } else {
						formattedImmigrationInfo += "\nNo country-specific information available.";
					  }
					  formattedImmigrationInfo += "\n---\n"; // Add separator between services
					});
				  } else {
					formattedImmigrationInfo += "No specific immigration information found for this country.";
				  }
			} else {
				formattedImmigrationInfo +=
					"Could not retrieve detailed immigration information.";
			}

			return dedent`${formattedImmigrationInfo}`;
		} catch (error) {
			// Rewriting error messages to be relevant to immigration information
			if (error instanceof Error) {
				return `Error fetching immigration information for ${params.countryCode}: ${error.message}`;
			}
			return `An unknown error occurred while fetching immigration information for ${params.countryCode}`;
		}
	},
};
