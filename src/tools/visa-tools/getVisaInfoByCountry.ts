import dedent from "dedent";
import { z } from "zod";
import { visaService } from "../../services/visaService.js";

const getVisaCountryParam = z.object({
	countryCode: z
		.string()
		.describe("The ISO 3166-1 alpha-3 country code (e.g., 'USA', 'GHA')."),
	currencyCode: z
		.string()
		.optional()
		.describe(
			"Optional currency code for the country, if applicable (e.g., 'USD', 'EUR').",
		),
});

type getVisaCountryParam = z.infer<typeof getVisaCountryParam>;

export const getVisaInfoByCountry = {
	name: "GET_VISA_INFO_BY_COUNTRY",
	description: "Get visa information for a specific country.",
	parameters: getVisaCountryParam,
	execute: async (params: getVisaCountryParam) => {
		try {
			const visaInfoResponse = await visaService.getVisaInfoByCountry(
				params.countryCode,
				params.currencyCode,
			);

			let formattedOutput = `🛂 Visa information for ${params.countryCode}:\n`;

			if (visaInfoResponse && visaInfoResponse.data) {
				const { visaCountry, visaNews, visaFaq, visaTypes, bookingsCount } = visaInfoResponse.data;
				
				// Country Information
				if (visaCountry) {
				  formattedOutput += `\n🌍 Country: ${visaCountry.name} (${visaCountry.country_code})`;
				  formattedOutput += `\n📸 Image: ${visaCountry.image || "N/A"}`;
				  formattedOutput += `\n👥 Banned Countries: ${visaCountry.banned?.join(", ") || "None"}`;
				  formattedOutput += `\n✈️ No Visa Required For: ${visaCountry.no_visa?.join(", ") || "None"}`;
				  formattedOutput += `\n⚠️ Status: ${visaCountry.status || "N/A"}`;
				} else {
				  formattedOutput += "\nNo country details found.";
				}
			  
				// Visa News
				if (visaNews && visaNews.length > 0) {
				  formattedOutput += "\n\n📰 Visa News:";
				  visaNews.forEach((news:any) => {
					formattedOutput += `\n  - ${news.title || "No title"}: ${news.content || "No content"}`;
				  });
				}
			  
				// Visa FAQ
				if (visaFaq && visaFaq.length > 0) {
				  formattedOutput += "\n\n📚 Visa FAQ:";
				  visaFaq.forEach((faq:any) => {
					formattedOutput += `\n  - 💬 Question: ${faq.question || "No question"}`;
					formattedOutput += `\n    💬 Answer: ${faq.answer || "No answer"}`;
				  });
				}
			  
				// Visa Types
				if (visaTypes && visaTypes.length > 0) {
				  formattedOutput += "\n\n🎟️ Visa Types:";
				  visaTypes.forEach((type:any) => {
					formattedOutput += `\nVisa Type: ${type.name || "N/A"}`;
					formattedOutput += `\n🌍 Country Code: ${type.country_code || "N/A"}`;
					formattedOutput += `\n#️⃣ Base Code: ${type.base_code || "N/A"}`;
					formattedOutput += `\n💰 Total Price: $${type.total_price || "N/A"}`;
					formattedOutput += `\n💰 Processing Fee: $${type.processing_fee || "N/A"}`;
					formattedOutput += `\n💰 Government Fee: $${type.government_fee || "N/A"}`;
					formattedOutput += `\n💼 Entry Type: ${type.entry_type || "N/A"}`;
					formattedOutput += `\n⏰ Validity Period: ${type.validity_period || "N/A"} days`;
					formattedOutput += `\n✅ Status: ${type.status || "N/A"}`;
			  
					if (type.keyRequirements && type.keyRequirements.length > 0) {
					  formattedOutput += "\n📄 Key Requirements:";
					  type.keyRequirements.forEach((req:any) => {
						formattedOutput += `\n  - ${req.requirement || "N/A"}`;
					  });
					}
			  
					if (type.benefits && type.benefits.length > 0) {
					  formattedOutput += "\n⭐ Benefits:";
					  type.benefits.forEach((benefit:any) => {
						formattedOutput += `\n  - ${benefit.benefit || "N/A"}`;
					  });
					}
			  
					if (type.additionalRequirements && type.additionalRequirements.length > 0) {
					  formattedOutput += "\n⚠️ Additional Requirements:";
					  type.additionalRequirements.forEach((additionalRequirement:any) => {
						formattedOutput += `\n  - ${additionalRequirement.question || "N/A"}`;
					  });
					}
			  
					formattedOutput += "\n---\n"; // Add separator between visa types
				  });
				}
			  
				formattedOutput += `\n🛒 Total Bookings: ${bookingsCount || 0}`;
			  } else {
				formattedOutput += "Could not retrieve visa information.";
			  }

			return dedent`${formattedOutput}`;
		} catch (error) {
			if (error instanceof Error) {
				return `Error fetching visa information for ${params.countryCode}: ${error.message}`;
			}
			return `An unknown error occurred while fetching visa information for ${params.countryCode}`;
		}
	},
};
