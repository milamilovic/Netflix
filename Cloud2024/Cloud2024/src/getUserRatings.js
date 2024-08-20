const { DynamoDBClient, QueryCommand } = require('@aws-sdk/client-dynamodb');
const dynamoDbClient = new DynamoDBClient();

exports.handler = async (event) => {
    const tableName = process.env.TABLE_NAME;
    const username = event.queryStringParameters.username;

    // check username

    const params = {
        TableName: tableName,
        IndexName: 'UsernameIndex',
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

        const movieRatings = items.map(item => ({
            movieId: item.movieId.S,
            rating: item.rating.S,
            timestamp: item.timestamp.S
        }));

        return {
            statusCode: 200,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "Content-Type",
                "Access-Control-Allow-Methods": "OPTIONS,POST,GET"
            },
            body: JSON.stringify(movieRatings)
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
            body: JSON.stringify({ error: 'Could not get ratings' })
        };
    }*/
};
