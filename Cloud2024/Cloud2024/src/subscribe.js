const { DynamoDBClient, PutItemCommand, GetItemCommand, UpdateItemCommand } = require('@aws-sdk/client-dynamodb');
const dynamoDbClient = new DynamoDBClient();
const subscriptionsTableName = process.env.SUBSCRIPTIONS_TABLE_NAME;

exports.handler = async (event) => {
    /*try {*/
        const requestJSON = JSON.parse(event.body);
        const { data, username } = requestJSON;
        const { userId, userEmail, subscribedActors, subscribedDirectors, subscribedGenres } = data;

        const item = {
            userId: { S: userId },
            userEmail: { S: userEmail },
            subscribedActors: { SS: subscribedActors },
            subscribedDirectors: { SS: subscribedDirectors },
            subscribedGenres: { SS: subscribedGenres },
            username: { S: username }
        };

        const existingItem = await dynamoDbClient.send(new GetItemCommand({
            TableName: subscriptionsTableName,
            Key: { userId: { S: userId } }
        }));

        let command;
        if (existingItem.Item) {
            command = new UpdateItemCommand({
                TableName: subscriptionsTableName,
                Key: { userId: { S: userId } },
                UpdateExpression: 'SET userEmail = :userEmail, subscribedActors = :subscribedActors, subscribedDirectors = :subscribedDirectors, subscribedGenres = :subscribedGenres',
                ExpressionAttributeValues: {
                    ':userEmail': { S: userEmail },
                    ':subscribedActors': { SS: subscribedActors },
                    ':subscribedDirectors': { SS: subscribedDirectors },
                    ':subscribedGenres': { SS: subscribedGenres }
                }
            });
        } else {
            command = new PutItemCommand({
                TableName: subscriptionsTableName,
                Item: item,
                ConditionExpression: 'attribute_not_exists(userId)'
            });
        }

        await dynamoDbClient.send(command);

        return {
            statusCode: 200,
            headers: {
                "Access-Control-Allow-Origin": "*", // Required for CORS support to work
                "Access-Control-Allow-Credentials": true, // Required for cookies, authorization headers with HTTPS
            },
            body: JSON.stringify({ message: 'Subscription added successfully' })
        };
    /*} catch (err) {
        console.error('Error adding subscription:', err);
        return {
            statusCode: 500,
            headers: {
                "Access-Control-Allow-Origin": "*", // Required for CORS support to work
                "Access-Control-Allow-Credentials": true, // Required for cookies, authorization headers with HTTPS
            },
            body: JSON.stringify({ message: event.body })
        };
    }*/
};
