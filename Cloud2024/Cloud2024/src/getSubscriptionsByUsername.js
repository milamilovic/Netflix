const { DynamoDBClient, QueryCommand } = require('@aws-sdk/client-dynamodb');
const dynamoDbClient = new DynamoDBClient();

exports.handler = async (event) => {
    const tableName = process.env.TABLE_NAME;
    const username = event.queryStringParameters.username;

    // check userId

    const params = {
        TableName: tableName,
        IndexName: 'UsernameSubscriptionsIndex',
        KeyConditionExpression: '#un = :username',
        ExpressionAttributeNames: {
            '#un': 'username'
        },
        ExpressionAttributeValues: {
            ':username': { S: username }
        }
    };

    /*try {*/
        const data = await dynamoDbClient.send(new QueryCommand(params));
        const items = data.Items || [];

        const subscriptions = items.map(item => ({
            subscribedActors: item.subscribedActors.SS,
            subscribedDirectors: item.subscribedDirectors.SS,
            subscribedGenres: item.subscribedGenres.SS
        }));

        return {
            statusCode: 200,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "Content-Type",
                "Access-Control-Allow-Methods": "OPTIONS,POST,GET"
            },
            body: JSON.stringify(subscriptions)
        };
    /*} catch (error) {
        console.error(error);
        return {
            statusCode: 500,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "Content-Type",
                "Access-Control-Allow-Methods": "OPTIONS,POST,GET"
            },
            body: JSON.stringify({ error: username })
        };
    }*/
};
