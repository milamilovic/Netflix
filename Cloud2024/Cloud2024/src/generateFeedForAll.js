const { DynamoDBClient, ScanCommand } = require('@aws-sdk/client-dynamodb');
const dynamoDbClient = new DynamoDBClient();

exports.handler = async (event) => {
    const feedTableName = process.env.FEED_TABLE_NAME;
    const help = event.body.helper;
    console.info(help);

    const allFeedsParams = {
        TableName: feedTableName
    };

    /*try {*/
        const command = new ScanCommand(allFeedsParams);
        const allFeedsItem = await dynamoDbClient.send(command);
        const allUsers = allFeedsItem.Items.map(item => {
            return item.username.S;
        });
        return {
            statusCode: 200,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "Content-Type",
                "Access-Control-Allow-Methods": "OPTIONS,POST,GET"
            },
            body: JSON.stringify(allUsers)
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
