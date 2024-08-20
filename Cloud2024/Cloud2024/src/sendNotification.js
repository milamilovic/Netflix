const { DynamoDBClient, ScanCommand } = require('@aws-sdk/client-dynamodb');
const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');
const dynamoDbClient = new DynamoDBClient();
const sesClient = new SESClient();

exports.handler = async (event) => {
    const subscriptionsTableName = process.env.SUBSCRIPTIONS_TABLE_NAME;

    for (const record of event.Records) {
        const movie = JSON.parse(record.body);

        const subscriptions = await dynamoDbClient.send(new ScanCommand({
            TableName: subscriptionsTableName
        }));

        for (const subscription of subscriptions.Items) {
            const userId = subscription.userId.S;
            const userEmail = subscription.userEmail.S;
            const subscribedActors = subscription.subscribedActors?.SS || [];
            const subscribedDirectors = subscription.subscribedDirectors?.SS || [];
            const subscribedGenres = subscription.subscribedGenres?.SS || [];

            const movieActors = movie.actors?.SS || [];
            const movieDirectors = movie.directors?.SS || [];
            const movieGenres = movie.genres?.SS || [];

            const isSubscribed = movieActors.some(actor => subscribedActors.includes(actor)) ||
                                 movieDirectors.some(director => subscribedDirectors.includes(director)) ||
                                 movieGenres.some(genre => subscribedGenres.includes(genre));

            if (isSubscribed) {
                const emailContent = `
                    A new movie matching your subscription is available:
                    
                    Title: ${movie.title.S}
                    Description: ${movie.description.S}
                    Actors: ${movieActors.join(', ')}
                    Directors: ${movieDirectors.join(', ')}
                    Genres: ${movieGenres.join(', ')}
                `;

                const emailParams = {
                    Destination: {
                        ToAddresses: [userEmail]
                    },
                    Message: {
                        Body: {
                            Text: { Data: emailContent }
                        },
                        Subject: { Data: "New Movie Notification" }
                    },
                    Source: "nenad.beric00@gmail.com"
                };

                await sesClient.send(new SendEmailCommand(emailParams));
            }
        }
    }
};
