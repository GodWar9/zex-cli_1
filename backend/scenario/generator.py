import os
import json
import uuid
import google.generativeai as genai
from typing import Dict, Any
from dotenv import load_dotenv

load_dotenv()

# Configure Gemini
api_key = os.getenv("GEMINI_API_KEY")
if api_key:
    genai.configure(api_key=api_key)

generation_config = {
    "temperature": 0.4,
    "top_p": 0.95,
    "top_k": 64,
    "max_output_tokens": 4096,
    "response_mime_type": "application/json",
}

SYSTEM_PROMPT = """
You are generating a realistic AWS security incident scenario for a cloud security training simulator.

Generate a DETAILED, RICH environment JSON. Do not be minimal. Real AWS accounts are messy.

SCENARIO TYPE: {scenario_type}
COMPANY: {company_name} — {company_description}

Generate the following JSON structure. Every array must have MULTIPLE items as specified.

{
  "scenario_id": "uuid",
  "type": "inherited_startup" or "active_breach" or "pre_audit",
  "company": "Company Name",
  "stakes": "One line — what exactly is at risk",
  "time_limit_seconds": number (e.g. 900),
  "briefing": "3-4 sentence dramatic briefing. Real stakes. Specific numbers.",
  "environment": {
    "ec2_instances": [
      // Generate 4-6 instances. Mix of prod, staging, internal tools.
      // Include: id, name, type (t2.micro/m5.large), 
      // state (Running/Stopped), region, monitoring (bool),
      // Tags, public_ip, private_ip (optional)
      // At least 2 instances must have security vulnerabilities
    ],
    
    "s3_buckets": [
      // Generate 5-7 buckets. Mix of purposes.
      // Include: name, region, is_public (bool), encryption (None/AES-256),
      // files array (3-8 files each).
      // Each file: name, size, sensitive (bool)
      // SENSITIVE file examples: customer_data.csv, api_keys.txt, 
      // prod_db_backup.sql, employee_records.xlsx, private_key.pem
      // At least 2 buckets must be misconfigured
    ],
    
    "security_groups": [
      // Generate 3-5 security groups for different purposes
      // web-sg, db-sg, internal-sg, admin-sg, bastion-sg
      // Each has inbound_rules and outbound_rules arrays
      // Rule: protocol, port, source, description, dangerous (bool), id
      // DANGEROUS rules: 0.0.0.0/0 on 22, 3306, 5432, 27017, 6379, 8080
      // SAFE rules: 0.0.0.0/0 on 80, 443 — these are INTENTIONAL, do NOT flag
      // At least 3 dangerous rules spread across groups
    ],
    
    "iam": {
      "roles": [
        // Generate 3-4 roles
        // Each: name, used_by (ec2 instance ids), 
        // dangerous (bool),
        // policies array containing: policy_name, is_overpermissioned (bool), 
        // actual_json (real AWS policy JSON string), safer_alternative_json (string JSON),
        // why_dangerous (explanation string)
      ],
      "users": [
        // Generate 3-5 IAM users
        // Each: username, mfa_enabled (bool), 
        // active_keys (bool)
        // At least 2 users without MFA
        // At least 1 user with old unused access keys (>90 days)
      ],
      "root_account": {
        "mfa_enabled": false,
        "active_access_keys": true
      }
    },
    
    "cloudwatch_logs": [
      // Generate 8-12 log entries that tell a story
      // timestamp, level, message, source
    ]
  },
  
  "vulnerabilities": [
    // List ALL vulnerabilities explicitly
    // Each: id, type, severity (CRITICAL/HIGH/MEDIUM/LOW),
    // resource (name or id), description,
    // why_dangerous (2-3 sentence real explanation),
    // fix_action, points, real_world_example (name a real breach this caused)
  ],
  
  "attacker_sequence": [
    // 8-12 timed attacker actions
    // at_second, action, targets_vuln
  ]
}

IMPORTANT RULES:
- Port 80 and 443 open to 0.0.0.0/0 are NOT vulnerabilities — they are correct
- Include real AWS policy JSON, not placeholder text
- why_dangerous must explain the real risk in plain English
- real_world_example must reference a real breach (Capital One, Uber, etc.)
- Make the company feel real — use realistic names, IPs, dates

Respond with ONLY the JSON. No markdown, no explanation.
"""

def generate_scenario() -> Dict[str, Any]:
    try:
        model = genai.GenerativeModel(
            model_name=os.getenv("GEMINI_MODEL", "gemini-2.0-flash"),
            system_instruction=SYSTEM_PROMPT,
            generation_config=generation_config
        )
        response = model.generate_content("Generate a random challenge scenario. Output only JSON.")
        text = response.text.strip()
        if text.startswith("```json"):
            text = text[7:]
        if text.startswith("```"):
            text = text[3:]
        if text.endswith("```"):
            text = text[:-3]
        data = json.loads(text.strip())
        data['scenario_id'] = str(uuid.uuid4())
        return data
    except Exception as e:
        print(f"Error generating scenario: {e}")
        # Return a fallback scenario in case of errors
        return backup_scenario()

def generate_debrief(log: list, vulnerabilities: list) -> str:
    try:
        model = genai.GenerativeModel(
            model_name=os.getenv("GEMINI_MODEL", "gemini-2.0-flash")
        )
        prompt = f"""
        You are a senior security engineer giving a debrief to a junior who just completed an incident response simulation.
        Here are the initial vulnerabilities: {json.dumps(vulnerabilities)}
        Here is the log of what they fixed and when: {json.dumps(log)}
        
        Write a 150-200 word honest debrief highlighting what they did well, their priority calling, and what they missed or failed to fix in time.
        Keep it professional, constructive, and realistic. Don't mention it's a simulation explicitly.
        """
        response = model.generate_content(prompt)
        return response.text
    except Exception as e:
        return f"Debrief generation failed: {str(e)}"

def backup_scenario():
    return {
      "scenario_id": str(uuid.uuid4()),
      "type": "inherited_startup",
      "company": "PayFlow Inc.",
      "stakes": "Customer payment data exposed",
      "time_limit_seconds": 900,
      "briefing": "You've just been hired as the first security engineer at PayFlow Inc. The previous admin left zero documentation. We process millions in transactions. You have 15 minutes before the audit kicks off, find anything critical.",
      "environment": {
        "ec2_instances": [
          {"id": "i-0abc123", "name": "web-server-prod", "type": "t2.micro", "state": "Running", "region": "us-east-1", "monitoring": False},
          {"id": "i-0def456", "name": "db-bastion", "type": "t2.small", "state": "Running", "region": "us-east-1", "monitoring": True}
        ],
        "s3_buckets": [
          {"name": "payflow-customer-data", "region": "us-east-1", "is_public": True, "encryption": "None", "files": [{"name": "customer_data.csv", "size": "45 MB", "sensitive": True}, {"name": "logs.txt", "size": "10 MB", "sensitive": False}]},
          {"name": "payflow-assets", "region": "us-east-1", "is_public": True, "encryption": "None", "files": [{"name": "logo.png", "size": "1 MB", "sensitive": False}]}
        ],
        "security_groups": [
          {
            "id": "sg-web-prod", "name": "web-sg", "vpc": "vpc-0123", 
            "inbound_rules": [
              {"id": "rule-1", "protocol": "TCP", "port": 22, "source": "0.0.0.0/0", "dangerous": True, "description": "SSH Open"},
              {"id": "rule-2", "protocol": "TCP", "port": 443, "source": "0.0.0.0/0", "dangerous": False, "description": "HTTPS"}
            ],
            "outbound_rules": []
          }
        ],
        "iam": {
          "roles": [
            {
              "name": "ec2-role-prod", 
              "used_by": ["i-0abc123"],
              "dangerous": True,
              "policies": [
                {
                  "policy_name": "AdministratorAccess",
                  "is_overpermissioned": True,
                  "actual_json": '{\n  "Version": "2012-10-17",\n  "Statement": [\n    {\n      "Effect": "Allow",\n      "Action": "*",\n      "Resource": "*"\n    }\n  ]\n}',
                  "safer_alternative_json": '{\n  "Version": "2012-10-17",\n  "Statement": [\n    {\n      "Effect": "Allow",\n      "Action": ["s3:GetObject"],\n      "Resource": "arn:aws:s3:::payflow-assets/*"\n    }\n  ]\n}',
                  "why_dangerous": "This policy grants full access to ALL AWS services. If this EC2 instance is compromised, the attacker controls your entire AWS account. This caused the Capital One breach when an SSRF flaw exposed the metadata service."
                }
              ]
            }
          ],
          "users": [
            {"username": "admin-bob", "mfa_enabled": False, "active_keys": True}
          ],
          "root_account": {
            "mfa_enabled": False,
            "active_access_keys": True
          }
        },
        "cloudwatch_logs": [
          {"timestamp": "08:12:00", "level": "WARN", "message": "Failed SSH attempt root@i-0abc123", "source": "EC2"},
          {"timestamp": "08:15:00", "level": "INFO", "message": "Public listing of bucket payflow-customer-data requested", "source": "S3"}
        ]
      },
      "vulnerabilities": [
        {"id": "vuln_001", "type": "s3_public_bucket", "resource": "payflow-customer-data", "severity": "CRITICAL", "description": "Bucket publicly readable", "why_dangerous": "Customer data is exposed to the public internet.", "fix_action": "set_bucket_private", "points": 300, "real_world_example": "Twilio 2020"},
        {"id": "vuln_002", "type": "sg_open_ssh", "resource": "sg-web-prod", "severity": "HIGH", "description": "SSH open to internet", "why_dangerous": "Bots will brute force this all day.", "fix_action": "delete_sg_rule", "points": 200, "real_world_example": "Capital One"}
      ],
      "attacker_sequence": [
        {"at_second": 30, "action": "Scanning for open security groups...", "targets_vuln": "vuln_002"},
        {"at_second": 90, "action": "SSH brute force attempt on web-server-prod...", "targets_vuln": "vuln_002"}
      ]
    }
