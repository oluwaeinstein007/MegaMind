import dedent from 'dedent';
import { z } from 'zod';
import { tool } from '@veridex/agents';
import { immigrationService } from '../../services/immigrationService.js';

export const getImmigrationInfoByCountry = tool({
  name: 'get_immigration_info_by_country',
  guidance: {
    summary: 'Get immigration paths, consultation fees, and services for a specific country by its ISO 2-letter country code.',
    whenToUse: [
      'The user asks about immigration programs, permanent residency routes, consultation fees, or administrative services for a specific country.',
      'To verify document submission requirements and consultation costs.',
    ],
    whenNotToUse: [
      'For tourist or short-term visa bookings and standard entry requirements — use `get_visa_info_by_country` instead.',
      'For crawling new web contents — use `ingest_url` instead.',
    ],
    successExample: '💼 Immigration information for CA:\n🏛️ Service: Express Entry Pathway\n📄 Description: Skilled worker pathway...\n🌍 Country: CA\n💰 Consultation Fee: $150',
  },
  input: z.object({
    countryCode: z
      .string()
      .describe("The ISO 3166-1 alpha-2 country code (e.g., 'US', 'GB', 'CA')."),
  }),
  safetyClass: 'read',
  async execute({ input }) {
    try {
      const immigrationInfo = await immigrationService.getImmigrationInfoByCountry(
        input.countryCode
      );

      let formattedImmigrationInfo = `💼 Immigration information for ${input.countryCode}:\n`;

      if (
        immigrationInfo && immigrationInfo.data && Array.isArray(immigrationInfo.data.data)
      ) {
        if (immigrationInfo.data.data.length > 0) {
          immigrationInfo.data.data.forEach((service: any) => {
            formattedImmigrationInfo += `\n🏛️ Service: ${service.name || 'N/A'}`;
            formattedImmigrationInfo += `\n📄 Description: ${service.description || 'N/A'}`;
            formattedImmigrationInfo += `\n💬 Consultation Note: ${service.consultation_note || 'N/A'}`;

            if (Array.isArray(service.countries) && service.countries.length > 0) {
              service.countries.forEach((country: any) => {
                formattedImmigrationInfo += `\n🌍 Country: ${country.country_code || 'N/A'}`;
                formattedImmigrationInfo += `\n💰 Consultation Fee: $${country.consultation_fee || 'N/A'}`;
                formattedImmigrationInfo += `\n💰 Service Fee: $${country.service_fee || 'N/A'}`;

                if (Array.isArray(country.requirements) && country.requirements.length > 0) {
                  formattedImmigrationInfo += '\n✅ Requirements:';
                  country.requirements.forEach((req: any) => {
                    formattedImmigrationInfo += `\n  - ${req.requirement || 'N/A'} (${req.response_type || 'N/A'})`;
                  });
                } else {
                  formattedImmigrationInfo += '\nNo specific requirements listed for this country.';
                }
                formattedImmigrationInfo += '\n';
              });
            } else {
              formattedImmigrationInfo += '\nNo country-specific information available.';
            }
            formattedImmigrationInfo += '\n---\n';
          });
        } else {
          formattedImmigrationInfo += 'No specific immigration information found for this country.';
        }
      } else {
        formattedImmigrationInfo += 'Could not retrieve detailed immigration information.';
      }

      return {
        success: true,
        llmOutput: dedent`${formattedImmigrationInfo}`,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        llmOutput: `Error fetching immigration information for ${input.countryCode}: ${message}`,
        error: message,
      };
    }
  },
});
