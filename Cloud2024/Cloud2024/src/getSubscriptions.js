const { DynamoDBClient, GetItemCommand } = require('@aws-sdk/client-dynamodb');
const { unmarshall } = require('@aws-sdk/util-dynamodb');
const dynamoDbClient = new DynamoDBClient();
const subscriptionsTableName = process.env.SUBSCRIPTIONS_TABLE_NAME;

exports.handler = async (event) => {
    try {
        const data = await dynamoDbClient.send(
            new GetItemCommand({
              TableName: subscriptionsTableName,
              Key: {
                userId: { S: event.queryStringParameters.id },
              },
            })
          );
        
        const item = unmarshall(data.Item);
        
        item.subscribedActors = data.Item.subscribedActors.SS;
        item.subscribedDirectors = data.Item.subscribedDirectors.SS;
        item.subscribedGenres = data.Item.subscribedGenres.SS;


        return {
            statusCode: 200,
            headers: {
                "Access-Control-Allow-Origin": "*", // Required for CORS support to work
                "Access-Control-Allow-Credentials": true // Required for cookies, authorization headers with HTTPS
            },
            body: JSON.stringify({
                item
            })
        };
    } catch (err) {
        return {
            statusCode: 200,
            headers: {
                "Access-Control-Allow-Origin": "*", // Required for CORS support to work
                "Access-Control-Allow-Credentials": true // Required for cookies, authorization headers with HTTPS
            },
            body: JSON.stringify({ message: 'Subscriptions not found' })
        };
    }
};
