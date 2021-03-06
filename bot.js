var Botkit = require('botkit');

var env = process.env.NODE_ENV = process.env.NODE_ENV || 'development';

var config = require('./src/config/config')[env];

const clientId = process.env.SLACK_CLIENT_ID;
const clientSecret = process.env.SLACK_CLIENT_SECRET;


if (!clientId || !clientSecret || !config.port) {
  console.log('Error: Specify clientId clientSecret and PORT in environment');
  process.exit(1);
}

const controller = Botkit.slackbot({
  debug: false,
  interactive_replies: true, // tells botkit to send button clicks into conversations
  json_file_store: './alfred-bot-db/'
});

const slackbot = controller.spawn({
  token: process.env.SLACK_TOKEN,
}).startRTM();

controller.configureSlackApp({
  clientId: process.env.SLACK_CLIENT_ID,
  clientSecret: process.env.SLACK_CLIENT_SECRET,
  redirectUri: 'https://00c4ebb2.ngrok.io/oauth',
  scopes: ['bot'],
  debug: true
});

// set up a botkit app to expose oauth and webhook endpoints
controller.setupWebserver(config.port, function (err, webserver) {

  // set up web endpoints for oauth, receiving webhooks, etc.
  controller
    .createHomepageEndpoint(controller.webserver)
    .createOauthEndpoints(controller.webserver, function (err, req, res) {
    })
    .createWebhookEndpoints(controller.webserver);

});

//register middleware
require('./src/middlewares/leave-service-registration')(controller, config);

controller.hears('', 'direct_mention,mention', function (bot, message) {
  const user = message.user;

  bot.startPrivateConversation({
    user: user
  }, function (err, convo) {
    if (!err && convo) {
      convo.say({
        text: `Hello <@${user}> :wave:`,
        attachments: [
          {
            title: 'I cannot talk on public channels. But I\'m all ears out here :simple_smile:',
            text: 'Type `help` to learn more about me.',
            mrkdwn_in: ['text']
          }
        ]
      });
    }
  });
});

require('./src/skills/initialize-brains')(controller);

controller.on('interactive_message_callback', function (bot, message) {

  const callbackId = message.callback_id;
  const handler = require('./src/skills/interactive-message-handler-factory')(callbackId);
  if(!handler){
    bot.replyInteractive(message, "Oops. Found myself in an unknown territory. :confused: ");
  }
  else {
    const response = handler.handleResponse(message.actions[0].value);
    bot.replyInteractive(message, response);
  }
});

