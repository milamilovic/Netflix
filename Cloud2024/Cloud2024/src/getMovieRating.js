const { DynamoDBClient, QueryCommand } = require('@aws-sdk/client-dynamodb');
const dynamoDbClient = new DynamoDBClient();

exports.handler = async (event) => {
    const tableName = process.env.TABLE_NAME;
    const movieId = event.queryStringParameters.movieId;
    const username = event.queryStringParameters.username;

    const queryParams = {
        TableName: tableName,
        IndexName: "MovieRateIndex",
        KeyConditionExpression: "movieId = :movieId AND username = :username",
        ExpressionAttributeValues: {
            ":movieId": { S: movieId },
            ":username": { S: username }
        }
    };

    /*try {*/
        const queryCommand = new QueryCommand(queryParams);
        const result = await dynamoDbClient.send(queryCommand);

        if (result.Items.length > 0) {
            return {
                statusCode: 200,
                headers: {
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Headers": "Content-Type",
                    "Access-Control-Allow-Methods": "OPTIONS,GET"
                },
                body: JSON.stringify({ rating: result.Items[0].rating.S }),
            };
        } else {
            return {
                statusCode: 200,
                headers: {
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Headers": "Content-Type",
                    "Access-Control-Allow-Methods": "OPTIONS,GET"
                },
                body: JSON.stringify({ message: 'Rating not found' }),
            };
        }
    /*} catch (error) {
        console.error(error);
        return {
            statusCode: 500,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "Content-Type",
                "Access-Control-Allow-Methods": "OPTIONS,GET"
            },
            body: JSON.stringify({ message: error.message }),
        };
    }*/
};
