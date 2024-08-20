import json
import logging
import os
import jwt

logger = logging.getLogger()
logger.setLevel(logging.INFO)

USER_POOL_ID = os.environ.get('USER_POOL_ID')
CLIENT_ID = os.environ.get('CLIENT_ID')

def handler(event, context):
    # Extract the id token from the event
    authorization_header = event.get('authorizationToken')
    method_arn = event.get('methodArn')
    logger.info(f"ARN {method_arn}")
    if not authorization_header:
        logger.info(f"No authorization header")
        return generate_policy('user', 'Deny', method_arn)
    
    token_parts = authorization_header.split()
    id_token = token_parts[1] if len(token_parts) == 2 else None
    
    if not id_token:
        logger.info(f"No id token")
        return generate_policy('user', 'Deny', method_arn)

    # Verify the JWT token
    try:
        # Decode and verify the token
        decoded_token = jwt.decode(id_token, options={"verify_signature": False})
        
        logger.info(f"Decoded token {decoded_token}")
        
        if decoded_token.get('token_use') != 'id':
            logger.info(f"Invalid token use")
            return generate_policy('user', 'Deny', method_arn)
        
        principal_id = decoded_token['sub']
        role = decoded_token.get('custom:role')
        if role == "admin":
            return generate_policy(principal_id, 'Allow', method_arn)
        else:
            return generate_policy(principal_id, 'Deny', method_arn)
        
    except jwt.ExpiredSignatureError:
        logger.info(f"Token expired")
        return generate_policy('user', 'Deny', method_arn)
    
    except jwt.InvalidTokenError as e:
        logger.info(f"Invalid token")
        return generate_policy('user', 'Deny', method_arn)
    
    except Exception as e:
        logger.info(f"ERROR SE DESIO: {e}")
        return generate_policy('user', 'Deny', method_arn)

def generate_policy(principal_id, effect, method_arn):
    auth_response = {
        "principalId": principal_id
    }
    
    if effect and method_arn:
        policy_document = {
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Action": "execute-api:Invoke",
                    "Effect": effect,
                    "Resource": method_arn
                }
            ]
        }
        auth_response['policyDocument'] = policy_document
    
    return auth_response
