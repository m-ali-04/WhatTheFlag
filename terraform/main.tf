resource "aws_instance" "target_node" {
  ami           = "ami-0e2c8ccd4e022c1d7" # Standard Ubuntu 22.04 LTS in us-east-1
  instance_type = "t3.medium"
  subnet_id     = aws_subnet.public_subnet.id
  vpc_security_group_ids = [aws_security_group.game_sg.id]
  key_name      = "WTFlag" # Must match your .pem file name in AWS

  tags = {
    Name = "Target-Node-K8s"
  }

  root_block_device {
    volume_size = 20 # 20GB is usually enough for a student K8s project
  }
}
