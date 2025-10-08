export const config = {
	weatherApi: {
		baseUrl: "https://api.openweathermap.org/data/2.5",
		apiKey: process.env.OPENWEATHER_API_KEY || "",
		defaultUnits: "metric", // metric (Celsius) or imperial (Fahrenheit)
	},
	visaApi: {
		baseUrl: "https://agile-scrubland-71136-72b75abf9926.herokuapp.com/api/v1",
		apiKey: process.env.VISA_API_KEY || "",
		defaultCurrency: "USD", // Default currency for transactions
	},
	immigrationApi: {
		baseUrl: "https://agile-scrubland-71136-72b75abf9926.herokuapp.com/api/v1",
		apiKey: process.env.IMMIGRATION_API_KEY || "",
		defaultRegion: "US", // Default region
	},
};
