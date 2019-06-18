import * as Slack from "slack-node"

export class SlackClient {
    appName: string;
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
    constructor(appName="Please configure app name", channel = "#airflow-alerts", username = "Lebrawwwwn James", iconEmoji = ":ghost:") {
        const webhookUri = "https://hooks.slack.com/services/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";
        this.slackClient = new Slack();
        this.slackClient.setWebhook(webhookUri);

        this.appName = appName;
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
                text: `${this.appName}: ${"```" + text + "```"}`
            }, (err, response) => {
                if (err) {
                    console.log('err', err);
                    reject(err);
                } else {
                    resolve(response);
                }
            })
        })
    }

    async sendError(error: Error) {
        const formattedError: string = JSON.stringify({
            message: error.message,
            stack: error.stack,
            type: "ERROR"
        })
        await this.sendMessage(formattedError)
    }
}
