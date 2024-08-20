const { DynamoDBClient, GetItemCommand } = require('@aws-sdk/client-dynamodb');
const dynamoDbClient = new DynamoDBClient();
const { unmarshall } = require('@aws-sdk/util-dynamodb');

// vraca sve id filmova iz tabele userMovies

exports.handler = async (event) => {
    const tableName = process.env.TABLE_NAME;
    const username = event.queryStringParameters.username;

    // check userId

    const params = {
        TableName: tableName,
        Key: {
            username: { S: username },
        }
    };

    /*try {*/
        const result = await dynamoDbClient.send(new GetItemCommand(params));
        const item = unmarshall(result.Item);
        item.movieIds = result.Item.movieIds.SS;
        if (!result.Item) {
            return {
                statusCode: 200,
                headers: {
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Headers": "Content-Type",
                    "Access-Control-Allow-Methods": "OPTIONS,POST,GET"
                },
                body: 'No movies found for the user'
            };
        }

        return {
            statusCode: 200,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "Content-Type",
                "Access-Control-Allow-Methods": "OPTIONS,POST,GET"
            },
            body: JSON.stringify(result)
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
            body: JSON.stringify({ error: 'Could not get movies' })
        };
    }*/
};
