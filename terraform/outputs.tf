# ============================================================
# outputs.tf — Values printed after 'terraform apply'.
# Resource names match main.tf exactly: aws_instance.target_node
# ============================================================

output "instance_public_ip" {
  description = "Public IP of the EC2 instance (use this for SSH and Ansible)"
  value       = aws_instance.target_node.public_ip
}

output "instance_id" {
  description = "AWS Instance ID"
  value       = aws_instance.target_node.id
}

output "ami_used" {
  description = "The AMI that was automatically selected"
  value       = data.aws_ami.ubuntu.id
}
