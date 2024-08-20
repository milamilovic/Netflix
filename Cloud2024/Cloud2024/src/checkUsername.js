const { CognitoIdentityProviderClient, AdminGetUserCommand } = require('@aws-sdk/client-cognito-identity-provider');
const cognitoClient = new CognitoIdentityProviderClient({ });

exports.handler = async (event) => {
  const username = event.queryStringParameters.username;
  const userPoolId = process.env.COGNITO_USER_POOL_ID; 

  if (!username) {
    return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Username is required' }),
        headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type",
            "Access-Control-Allow-Methods": "OPTIONS,GET"
        },
    }
  }

  const params = {
    UserPoolId: userPoolId,
    Username: username
  };

  try {
    const command = new AdminGetUserCommand(params);
    await cognitoClient.send(command);
    return {
        statusCode: 200,
        body: JSON.stringify({ exists: true }),
        headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type",
            "Access-Control-Allow-Methods": "OPTIONS,GET"
        },
    };
  } catch (error) {
    if (error.name === 'UserNotFoundException') {
      return {
        statusCode: 200,
        body: JSON.stringify({ exists: false }),
        headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type",
            "Access-Control-Allow-Methods": "OPTIONS,GET"
        },
      };
    } else {
      return {
        statusCode: 500,
        body: JSON.stringify({ 
            message: "Greska sa 500",
            error: error.message, 
        }),
        headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type",
            "Access-Control-Allow-Methods": "OPTIONS,GET"
        },
      };
    }
  }
};
