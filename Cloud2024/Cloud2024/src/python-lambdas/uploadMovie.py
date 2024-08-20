import json
import boto3
import base64
import os
import logging

sqs_client = boto3.client('sqs')
s3_client = boto3.client('s3')

logger = logging.getLogger()
logger.setLevel(logging.INFO)

def handler(event, context):
    try:
        queue_url = os.environ['SQS_QUEUE_URL']
        bucket_name = os.environ['HELPER_BUCKET_NAME']
    
        parsed_body = json.loads(event['body'])
        id = parsed_body['id']
        file_content = base64.b64decode(parsed_body['fileContent'])
        desired_width = parsed_body['width']
        desired_height = parsed_body['height']

        file_key = f"{id}_{desired_width}_{desired_height}.mp4"

        s3_client.put_object(Bucket=bucket_name, Key=file_key, Body=file_content, ContentType='video/mp4')

        sqs_params = {
            'QueueUrl': queue_url,
            'MessageBody': json.dumps({
                'id': id,
                'file_key': file_key,
                'desired_width': desired_width,
                'desired_height': desired_height
            })
        }
        sqs_response = sqs_client.send_message(**sqs_params)
        logger.info(f"SQS Response: {sqs_response}")
        
        return {
            'statusCode': 200,
            'headers': {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Credentials": "true"
            },
            'body': json.dumps({"message": "Request accepted and queued for transcoding."}),
        }
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Credentials": "true"
            },
            'body': json.dumps({"error": str(e)}),
        }
