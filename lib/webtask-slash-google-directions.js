'use latest';

//dependencies
const url = require('url');
const rp = require('request-promise');
const sanitizeHtml = require('sanitize-html');

/**
 * @description Webtask used to provide directions from any origin to a target destination
 * using the google maps directions API.
 * 
 * @see https://webtask.io
 * @see https://github.com/auth0/slash
 * @author Derek R. Melvin (https://github.com/demelvin)
 */
//constants
const GOOGLE_DIRECTIONS_API_URL = 'https://maps.googleapis.com/maps/api/directions/json';
const GOOGLE_MAPS_DIRECTIONS_URL = 'https://www.google.com/maps/dir/';
const GOOGLE_API_VERSION = '1';
const GOOGLE_COPYRIGHT_IMG_URL = '';
const DEFAULT_TRANSPORT_MODE = 'driving';
const HTML_SANITIZE_DEFAULTS = {
	allowedTags: []	
};
const STATUS_OK = 'OK';
const NO_RESULTS = 'ZERO_RESULTS';
const NOT_FOUND = 'NOT_FOUND';
const SUMMARY_PREFIX = 'via ';
const SLACK_MSG = {
	COLOR:'#36a64f',
	AUTHOR: {
		NAME: 'Google Maps',
		ICON_URL: 'https://www.google.com/images/branding/product/2x/maps_48dp.png',
		LINK_URL: 'https://www.google.com/maps'
	}
};
const MESSAGE = {
	NO_RESULTS: 'Sorry, I couldn\'t find any directions',
	NOT_FOUND: 'Sorry, I didn\'t find any matching locations. Try the name or entering the full address',
	ERROR: 'Google has been put in timeout. Please try again later',
	USAGE: {
		attachments: [{
			fallback: ':frowning: Sorry I couldn\'t understand that. Please try again',
			color: 'warning',
			pretext: 'Sorry I couldn\'t understand that. Let me help you out...',
			author_name: 'Usage',
			text: '/wt directions <origin> to <destination>',
			fields: [{
				title: 'Example',
				value: '/wt directions Bellevue, WA to Seattle, WA',
				short: false
			}]
		}]
	}
};
var WT_PARAM_DELIMITER = ' to ';

/**
* Creates the request URL used to fetch directions.
* 
* @param {String} path - the url path
* @param {String} start - the starting waypoint
* @param {String} end - the target destination waypoint
* @param {String=} googleApiKey - the google api key. If provided will be included
* 	in the query parameters
* @returns {String} requestUrl - the request url
*/
var getRequestUrl = (path, start, end, googleApiKey) => {
	const query = {
		origin: start, 
		destination: end,
		mode: DEFAULT_TRANSPORT_MODE,
	};
	
	//include the api key
	if(googleApiKey){
		query.key = googleApiKey;
	} else {
		//assume this is an external url
		query.api = GOOGLE_API_VERSION;
	}
	
	return url.format({
		pathname : path,
		query : query
	});
};

/**
* Returns true if the given array is undefined or it is empty.
* 
* @param {Array} arr - the array to check
* @returns {Boolean} notEmpty - true if the array is undefined or is empty
* 	otherwise false
*/
var isEmpty = (arr) => {
	return (!Array.isArray(arr) || !arr || arr.length === 0);
};

/**
* Returns an array containing the fields to include in the Slack attachment.
* </p>
* For each step within the directions a field will be created.
* 
* @param {Object} directions - the directions containing
* @returns {Array<Object>} fields - an array containing the fields to include
* 	in the Slack attachment
*/
var getAttachmentFields = (directions) => {
	const fields = [];
	var steps = directions.steps;
	for(var i = 0; i < steps.length; i++){
		let step = steps[i];
		let field = {
          title: step.text,
          value: `${step.duration} (${step.distance})`,
          short: false
		};
		fields.push(field);
	}
	return fields;
};

/**
* Creates and returns a slack formatted message for the 
* given directions.
* 
* @param {String} username - the Slack username
* @param {Object} directions - the directions to include within the Slack
* 	formatted message
*/
var getSlackMessage = (username, directions) => {
	const preText = `Okay ${username}. Here are your directions...`;
	const message = {
		attachments: [{
			fallback: preText,
			color: SLACK_MSG.COLOR,
			pretext: preText,
			author_name: SLACK_MSG.AUTHOR.NAME,
			author_link: SLACK_MSG.AUTHOR.LINK_URL,
			author_icon: SLACK_MSG.AUTHOR.ICON_URL,
			title: directions.summary,
			title_link: directions.link,
			text: `${directions.duration} (${directions.distance})`,
			fields: getAttachmentFields(directions),
			footer: directions.copyright,
			footer_icon: GOOGLE_COPYRIGHT_IMG_URL  
		}]
	};
	return message;
};


/**
* Returns an array of step objects containing the various
* steps required to reach the destination. Each object
* will contain the textual representation of the step
* and additional metadata information.
* 
* @param {Array<Object>} steps - the steps returned in the google API response
* @returns {Array<Object>} displaySteps - the array containing the domain step objects
*/
var buildSteps = (steps) => {
	var displaySteps = [];
	for(var i = 0; i < steps.length; i++){
		let step = steps[i];
		let instructions = sanitizeHtml(step.html_instructions, HTML_SANITIZE_DEFAULTS);
		displaySteps.push({
			num: (i + 1),
			text: instructions,
			duration: step.duration.text,
			distance: step.distance.text
		});
	}
	return displaySteps;
};

/**
* Returns the directions from the given response.
* 
* @param {String} start - the starting waypoint
* @param {String} end - the ending waypoint
* @param {Object} response - the response object received from Google
* @returns {Object} directions - the requested directions containing the steps
* 	along with various other metadata to embed in the slack message
*/
var buildDirections = (start, end, response) => {
	var directions = {
		origin: start,
		destination: end,
		summary: undefined,
		copyright: undefined,
		duration: undefined,
		distance: undefined,
		steps: [],
		link: getRequestUrl(GOOGLE_MAPS_DIRECTIONS_URL, start, end)
	};
	if(!isEmpty(response.routes)){
		let route = response.routes[0];
		directions.summary = (SUMMARY_PREFIX + route.summary);
		directions.copyright = route.copyrights;
		let legs = route.legs;
		if(!isEmpty(legs)){
			let leg = legs[0];
			directions.duration = leg.duration.text;
			directions.distance = leg.distance.text;
			directions.steps = buildSteps(leg.steps);

		}
	}
	
	return directions;
};

/**
* Invokes the given message callback passing
* the given message as the argument.
* 
* @param {Function} cb - the callback to invoke
* @param {Object} message - the message to pass back to the callback
*/
var invokeCallback = (cb, message) => {
	if(cb && (typeof cb === 'function')){
		cb(message);
	}
};

/**
* Fetches the directions using the Google Maps API.
* 
* @param {String} username - the Slack username
* @param {String} start - the starting point
* @param {String} end - the target destination
* @param {String} googleApiKey - the google api key used to make calls to the API
* @param {Function} cb - a callback function to invoke once complete.
* 	The callback function should accept a single parameter message which is the slack
*  message to display within the Slack channel
*/
var fetchDirections = (username, start, end, googleApiKey, cb) => {
	var options = {
		uri: getRequestUrl(GOOGLE_DIRECTIONS_API_URL, start, end, googleApiKey),
		json: true
	};
	var message = {};
	rp(options)
	.then(function(response){
		//handle response
		switch(response.status){
			case STATUS_OK:
				let directions = buildDirections(start, end, response);
				message = getSlackMessage(username, directions);
				break;
			case NO_RESULTS:
				message.text = MESSAGE.NO_RESULTS;
				break;
			case NOT_FOUND:
				message.text = MESSAGE.NOT_FOUND;
				break;
			default:
				// assume there was an issue
				message.text = MESSAGE.ERROR;
				break;
		}
		
		//invoke callback with result (Slack Message)
		invokeCallback(cb, message);
	})
	.catch(function(err){
		console.error(new Error('Woops! Something went wrong with the request. ' + err));
		message.text = MESSAGE.ERROR;
		invokeCallback(cb, message);
	});
};

/**
 * Returns the GOOGLE_API_KEY secret value from the
 * given context.
 * 
 * @param {Object} context - the webtask context
 * @returns {String} googleApiKey - the google API key used to make calls
 * 	to the API
 */
var getGoogleApiKey = (ctx) => {
	const googleApiKey = ctx.secrets.GOOGLE_API_KEY;
	if(!googleApiKey){
		console.warn('The GOOGLE_API_KEY value has not been set!. API call will likely fail');
	}
	return googleApiKey;
};

/**
 * Gets the directions to return to the Slack channel.
 * 
 * @param {Object} context - the webtask context
 * @param {Function} callback - the callback to invoke once complete
 */
var getDirections = (ctx, cb) => {
	//setup params
	const username = `<@${ctx.body.user_name}>`;
	const params = getWebtaskParams(ctx);
	const googleApiKey = getGoogleApiKey(ctx);
	
	//validate
	if(!params){
		//display usage in Slack to the user
		cb(null, MESSAGE.USAGE);
	} else {
		//get the directions
		fetchDirections(username, params.start, params.end, googleApiKey, (message) => {
			//send result to Slack!
			cb(null, message);
		});	
	}
};


/**
 * Returns the parameters object
 * 
 * @param {Object} ctx - the webtask context
 * @returns {Object | undefined} params - the webtask parameters or undefined
 * 	if an an invalid number of parameters was supplied
 */
var getWebtaskParams = (ctx) => {
	var params;
	const text = ctx.body.text;
	var startEndParams = text.split(WT_PARAM_DELIMITER);
	if(startEndParams.length === 2){
		params = {
			start: startEndParams[0],
			end: startEndParams[1]
		};
	}
	return params;
};

//expose a single function as the webtask
module.exports = (ctx, cb) => {
	//get directions
	getDirections(ctx, cb);
};