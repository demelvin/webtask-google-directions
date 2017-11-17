# Slash Webtask Used To Display Directions Within Slack
Webtask used to provide directions within Slack using the Google Directions API.

## Setup
[Login to Webtask](https://webtask.io/)

[Install on your Slack team](https://webtask.io/slack)

[Generate a Google Direction API Key](https://developers.google.com/maps/documentation/directions/get-api-key)

### Create a new webtask within Slack

After you have [installed Slash Webtasks](https://webtask.io/slack) on your Slack team, you can create the directions  webtask by typing the following as a Slack message within any Slack channel:

```
/wt make directions
``` 
#### Add the Webtask
Once the webtask has been successfully created click the **"Edit it in Webtask Editor"** link within the Slack message. Within the editor copy and paste the contents of the [webtask-slash-google-directions.js](./lib/webtask-slash-google-directions.js) file. Next save the Webtask using the save button near the top right of the editor (CTRL+s).

#### Add the Google API Key
In order to successfully authenticate with the [Google a Directions API key is needed](https://developers.google.com/maps/documentation/directions/get-api-key). This key needs to be added using the webtask editor to do this open the settings within the editor. 

To do this you can click the wrench icon near the upper left hand corner of the editor and selecting **Secrets**. Once the secrets UI is displayed click add secret and add the following key/value:

```
Secret Key: 'GOOGLE_API_KEY'
Secret Value: '${YOUR_GOOGLE_API_KEY}'
``` 

Hit the save button (CTRL+s) for good measure and you webtask setup is complete.

### Usage
Make sure you are within Slack and you have the [webtask Slack add on installed on your Slack channel](https://webtask.io/slack) then type the following command within the Slack message input:

```
/wt directions <origin> to <destination>
```

If you followed the setup correctly this webtask should respond with a list of directions.

### Resources
[Webtask](https://webtask.io/)

[Webtask Slack](https://webtask.io/slack)

[Auth0/Slash](https://github.com/auth0/slash)

[Google Directions API](https://developers.google.com/maps/documentation/directions/intro)
