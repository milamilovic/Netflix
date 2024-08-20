const { DynamoDBClient, DeleteItemCommand } = require('@aws-sdk/client-dynamodb');
const dynamoDbClient = new DynamoDBClient();

exports.handler = async (event) => {
    const tableName = process.env.TABLE_NAME;

    /*try {*/

        const params = {
            TableName: tableName,
            Key: {
                id: { S: event.queryStringParameters.id },
              },
            ConditionExpression: 'attribute_exists(id)'
        };

        await dynamoDbClient.send(new DeleteItemCommand(params));

        return {
            statusCode: 200,
            headers: {
                "Access-Control-Allow-Origin": "*", // Required for CORS support to work
                "Access-Control-Allow-Credentials": true, // Required for cookies, authorization headers with HTTPS
              },
            body: JSON.stringify({ message: 'Metadata deleted successfully!' })
        };
    /*} catch (error) {
        console.error(error);
        return {
            statusCode: error.name === 'ConditionalCheckFailedException' ? 400 : 500,
            headers: {
                "Access-Control-Allow-Origin": "*", // Required for CORS support to work
                "Access-Control-Allow-Credentials": true, // Required for cookies, authorization headers with HTTPS
              },
            body: JSON.stringify({ message: error.name === 'ConditionalCheckFailedException' ? 'Item does not exist' : 'Failed to delete metadata', error: error.message })
        };
    }*/
};
