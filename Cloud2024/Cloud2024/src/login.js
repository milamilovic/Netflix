const { CognitoIdentityProviderClient, InitiateAuthCommand } = require("@aws-sdk/client-cognito-identity-provider");

const client = new CognitoIdentityProviderClient({ });

exports.handler = async (event) => {
    requestJSON = JSON.parse(event.body);
    const username = requestJSON.username;
    const password = requestJSON.password;

    const params = {
        AuthFlow: "USER_PASSWORD_AUTH",
        ClientId: process.env.COGNITO_CLIENT_ID,
        AuthParameters: {
            USERNAME: username,
            PASSWORD: password,
        },
    };

    try {
        const command = new InitiateAuthCommand(params);
        const response = await client.send(command);
        return {
            statusCode: 200,
            body: JSON.stringify({
                message: "Login successful",
                accessToken: response.AuthenticationResult.AccessToken,
                idToken: response.AuthenticationResult.IdToken,
                refreshToken: response.AuthenticationResult.RefreshToken,
            }),
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "Content-Type",
                "Access-Control-Allow-Methods": "OPTIONS,POST,GET"
            },
        };
    } catch (error) {
        return {
            statusCode: 400,
            body: JSON.stringify({
                message: "Login failed" + username,
                error: error.message,
            }),
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "Content-Type",
                "Access-Control-Allow-Methods": "OPTIONS,POST,GET"
            },
        };
    }
};
