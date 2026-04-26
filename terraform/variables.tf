# ============================================================
# variables.tf — All configurable values in one place.
# Change these here instead of hunting through multiple files.
# ============================================================

variable "aws_region" {
  description = "AWS region to deploy into"
  type        = string
  default     = "us-east-1"
}

variable "key_name" {
  description = "Name of the SSH key pair (must already exist in your AWS account)"
  type        = string
  default     = "WTFlag"
}

variable "instance_type" {
  description = "EC2 instance size"
  type        = string
  default     = "t3.medium"
}

variable "volume_size" {
  description = "Root volume size in GB"
  type        = number
  default     = 20
}

variable "project_name" {
  description = "Project name used for tagging all resources"
  type        = string
  default     = "whattheflag"
}
