import dedent from 'dedent';
import { z } from 'zod';
import { tool } from '@veridex/agents';
import { visaService } from '../../services/visaService.js';

export const getVisaInfoByCountry = tool({
  name: 'get_visa_info_by_country',
  guidance: {
    summary: 'Get visa requirements, pricing, fees, and types for a specific country by its ISO 3-letter country code.',
    whenToUse: [
      'The user asks about visa requirements, fees, types, processing times, or validity for a specific destination.',
      'To fetch bookings statistics or country banning statuses.',
    ],
    whenNotToUse: [
      'For broad government services, consultation notes, or general immigration routes — use `get_immigration_info_by_country` instead.',
      'For looking up random travel inspirations — use `sample_travel_content` instead.',
    ],
    successExample: '🛂 Visa information for NGA:\n🌍 Country: Nigeria (NGA)\n👥 Banned Countries: None\n🎟️ Visa Types:\nVisa Type: Tourist Visa...',
  },
  input: z.object({
    countryCode: z
      .string()
      .describe("The ISO 3166-1 alpha-3 country code (e.g., 'USA', 'GHA')."),
    currencyCode: z
      .string()
      .optional()
      .describe("Optional currency code for the country, if applicable (e.g., 'USD', 'EUR')."),
  }),
  safetyClass: 'read',
  async execute({ input }) {
    try {
      const visaInfoResponse = await visaService.getVisaInfoByCountry(
        input.countryCode,
        input.currencyCode
      );

      let formattedOutput = `🛂 Visa information for ${input.countryCode}:\n`;

      if (visaInfoResponse && visaInfoResponse.data) {
        const { visaCountry, visaNews, visaFaq, visaTypes, bookingsCount } = visaInfoResponse.data;

        // Country Information
        if (visaCountry) {
          formattedOutput += `\n🌍 Country: ${visaCountry.name} (${visaCountry.country_code})`;
          formattedOutput += `\n📸 Image: ${visaCountry.image || 'N/A'}`;
          formattedOutput += `\n👥 Banned Countries: ${visaCountry.banned?.join(', ') || 'None'}`;
          formattedOutput += `\n✈️ No Visa Required For: ${visaCountry.no_visa?.join(', ') || 'None'}`;
          formattedOutput += `\n⚠️ Status: ${visaCountry.status || 'N/A'}`;
        } else {
          formattedOutput += '\nNo country details found.';
        }

        // Visa News
        if (visaNews && visaNews.length > 0) {
          formattedOutput += '\n\n📰 Visa News:';
          visaNews.forEach((news: any) => {
            formattedOutput += `\n  - ${news.title || 'No title'}: ${news.content || 'No content'}`;
          });
        }

        // Visa FAQ
        if (visaFaq && visaFaq.length > 0) {
          formattedOutput += '\n\n📚 Visa FAQ:';
          visaFaq.forEach((faq: any) => {
            formattedOutput += `\n  - 💬 Question: ${faq.question || 'No question'}`;
            formattedOutput += `\n    💬 Answer: ${faq.answer || 'No answer'}`;
          });
        }

        // Visa Types
        if (visaTypes && visaTypes.length > 0) {
          formattedOutput += '\n\n🎟️ Visa Types:';
          visaTypes.forEach((type: any) => {
            formattedOutput += `\nVisa Type: ${type.name || 'N/A'}`;
            formattedOutput += `\n🌍 Country Code: ${type.country_code || 'N/A'}`;
            formattedOutput += `\n#️⃣ Base Code: ${type.base_code || 'N/A'}`;
            formattedOutput += `\n💰 Total Price: $${type.total_price || 'N/A'}`;
            formattedOutput += `\n💰 Processing Fee: $${type.processing_fee || 'N/A'}`;
            formattedOutput += `\n💰 Government Fee: $${type.government_fee || 'N/A'}`;
            formattedOutput += `\n💼 Entry Type: ${type.entry_type || 'N/A'}`;
            formattedOutput += `\n⏰ Validity Period: ${type.validity_period || 'N/A'} days`;
            formattedOutput += `\n✅ Status: ${type.status || 'N/A'}`;

            if (type.keyRequirements && type.keyRequirements.length > 0) {
              formattedOutput += '\n📄 Key Requirements:';
              type.keyRequirements.forEach((req: any) => {
                formattedOutput += `\n  - ${req.requirement || 'N/A'}`;
              });
            }

            if (type.benefits && type.benefits.length > 0) {
              formattedOutput += '\n⭐ Benefits:';
              type.benefits.forEach((benefit: any) => {
                formattedOutput += `\n  - ${benefit.benefit || 'N/A'}`;
              });
            }

            if (type.additionalRequirements && type.additionalRequirements.length > 0) {
              formattedOutput += '\n⚠️ Additional Requirements:';
              type.additionalRequirements.forEach((additionalRequirement: any) => {
                formattedOutput += `\n  - ${additionalRequirement.question || 'N/A'}`;
              });
            }

            formattedOutput += '\n---\n';
          });
        }

        formattedOutput += `\n🛒 Total Bookings: ${bookingsCount || 0}`;
      } else {
        formattedOutput += 'Could not retrieve visa information.';
      }

      return {
        success: true,
        llmOutput: dedent`${formattedOutput}`,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        llmOutput: `Error fetching visa information for ${input.countryCode}: ${message}`,
        error: message,
      };
    }
  },
});
