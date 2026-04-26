# ============================================================
# main.tf — The EC2 instance.
#
# FIX for "InvalidAMIID.NotFound":
#   Instead of a hardcoded AMI, we use a data source that
#   automatically finds the latest Ubuntu 22.04 LTS image
#   for WHATEVER region you deploy into. No manual lookup needed.
# ============================================================

# --- Dynamic AMI lookup (works in any region) ---
data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"] # Canonical (official Ubuntu publisher)

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

# --- EC2 Instance ---
resource "aws_instance" "target_node" {
  ami                    = data.aws_ami.ubuntu.id
  instance_type          = var.instance_type
  subnet_id              = aws_subnet.public.id
  vpc_security_group_ids = [aws_security_group.app_sg.id]
  key_name               = var.key_name

  root_block_device {
    volume_size = var.volume_size
  }

  tags = { Name = "${var.project_name}-server" }
}
