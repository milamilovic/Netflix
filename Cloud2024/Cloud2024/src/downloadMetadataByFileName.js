const { DynamoDBClient, GetItemCommand, QueryCommand } = require('@aws-sdk/client-dynamodb');
const { unmarshall } = require('@aws-sdk/util-dynamodb');
const dynamoDbClient = new DynamoDBClient();

exports.handler = async (event) => {
  /*try {*/

    const fileName = event.queryStringParameters.fileName;

    const data = await dynamoDbClient.send(
        new QueryCommand({
            TableName: process.env.TABLE_NAME,
            IndexName: "FileNameIndex",
            KeyConditionExpression: "fileName = :fileName",
            ExpressionAttributeValues: {
              ":fileName": { S: fileName }
            }
          })
    );
    if (!data.Items || data.Items.length === 0) {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: "Item not found" })
      };
    }

    const item = unmarshall(data.Items[0]);
    item.actors = data.Items[0].actors.SS;
    item.genres = data.Items[0].genres.SS;
    item.directors = data.Items[0].directors.SS;
    item.qualities = data.Items[0].qualities.SS;
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        "Access-Control-Allow-Origin": "*", // Required for CORS support to work
        "Access-Control-Allow-Credentials": true, // Required for cookies, authorization headers with HTTPS
      },
      body: JSON.stringify(item),
    };
  /*} catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ message: event.queryStringParameters.fileName }),
    };
  }*/
};
