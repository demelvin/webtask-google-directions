'use strict';

//Dependencies
const webtask = require('./webtask-slash-google-directions');

/**
 * @description Test module used to test the webtask.
 * 
 * @author Derek R. Melvin (https://github.com/demelvin)
 */

/**
 * Test function used to test the webtask response.
 * </p>
 * This is useful to ensure that the Google Directions API is setup
 * correctly as well as inspect the object will be sent 
 * back to Slack within the console.
 */
var test = function(){
	const ctx = {
		body: {
			user_name: 'slackUsername',
			text: 'Bellevue, WA to Seattle, WA',
		},
		secrets: {
			GOOGLE_API_KEY: '${YOUR_GOOGLE_API_KEY}'
		}
	};
	
	//test the output of the webtask
	webtask(ctx, (err, slackMessage) => {
		console.log('Webtask Response: \n\n');
		console.dir(slackMessage);
	});
};

module.exports = {
	test: test
};