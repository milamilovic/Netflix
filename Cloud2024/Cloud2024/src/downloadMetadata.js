const { DynamoDBClient, GetItemCommand } = require('@aws-sdk/client-dynamodb');
const { unmarshall } = require('@aws-sdk/util-dynamodb');
const dynamoDbClient = new DynamoDBClient();

exports.handler = async (event) => {
  console.info(event)
  /*try {*/
    const data = await dynamoDbClient.send(
      new GetItemCommand({
        TableName: process.env.TABLE_NAME,
        Key: {
          id: { S: event.queryStringParameters.id },
        },
      })
    );
    if (!data.Item) {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: "Item not found" })
      };
    }

    const item = unmarshall(data.Item);
    //not decoded properly for some reason
    item.actors = data.Item.actors.SS;
    item.genres = data.Item.genres.SS;
    item.directors = data.Item.directors.SS;
    item.qualities = data.Item.qualities.SS;

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*", // Required for CORS support to work
        "Access-Control-Allow-Credentials": true, // Required for cookies, authorization headers with HTTPS
      },
      body: JSON.stringify(item),
    };
  /*} catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ message: event.queryStringParameters.id }),
    };
  }*/
};
