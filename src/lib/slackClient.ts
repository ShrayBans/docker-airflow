import * as Slack from "slack-node"

export class SlackClient {
    channel: string;
    username: string;
    iconEmoji: string;
    slackClient: Slack;

    /**
     * All params are optional and will default to the appropriate variables
     * @param channel
     * @param username
     * @param iconEmoji
     */
    constructor(channel = "#airflow-alerts", username = "Lebrawwwwn James", iconEmoji = ":ghost:") {
        const webhookUri = "https://hooks.slack.com/services/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";

        this.slackClient = new Slack();
        this.slackClient.setWebhook(webhookUri);

        this.channel = channel;
        this.username = username;
        this.iconEmoji = iconEmoji;
    }

    async sendMessage(text: string) {
        console.log('text', text);
        return new Promise((resolve, reject) => {
            this.slackClient.webhook({
                channel: this.channel,
                username: this.username,
                icon_emoji: this.iconEmoji,
                text: text
            }, (err, response) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(response);
                }
            })
        })
    }
}
