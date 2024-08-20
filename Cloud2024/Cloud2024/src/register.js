const { CognitoIdentityProviderClient, SignUpCommand, AdminConfirmSignUpCommand } = require("@aws-sdk/client-cognito-identity-provider");

const client = new CognitoIdentityProviderClient({ });

exports.handler = async (event) => {
    requestJSON = JSON.parse(event.body);
    const username = requestJSON.username;
    const password = requestJSON.password;
    const name = requestJSON.name;
    const surname = requestJSON.surname;
    const email = requestJSON.email;
    const birthday = requestJSON.birthday;

    const params = {
        ClientId: process.env.COGNITO_CLIENT_ID,
        Username: username,
        Password: password,
        UserAttributes: [
            { Name: 'name', Value: name },
            { Name: 'family_name', Value: surname },
            { Name: 'email', Value: email },
            { Name: 'birthdate', Value: birthday },
            { Name: 'custom:role', Value: 'user' }
        ]
    };

    try {
        const command = new SignUpCommand(params);
        const response = await client.send(command);

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: "Registration successful",
                user: response.User,
                response: response
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
                message: "Registration failed",
                error: error.message
            }),
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "Content-Type",
                "Access-Control-Allow-Methods": "OPTIONS,POST,GET"
            },
        };
    }
};
