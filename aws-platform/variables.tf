variable "region" {
  description = "AWS region for all resources"
  type        = string
  default     = "us-east-1"
}

variable "project" {
  description = "Name prefix used when tagging resources"
  type        = string
  default     = "learning-tracker"
}

variable "vpc_cidr" {
  description = "The IP address range for the whole VPC"
  type        = string
  default     = "10.0.0.0/16"   # ~65k addresses; plenty
}