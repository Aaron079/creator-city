import { IsEmail, IsString, MinLength, MaxLength, Matches } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class RegisterDto {
  @ApiProperty({ example: 'alice_creator' })
  @IsString()
  @MinLength(3)
  @MaxLength(30)
  @Matches(/^[a-zA-Z0-9_]+$/, { message: 'Username can only contain letters, numbers and underscores' })
  username: string

  @ApiProperty({ example: 'Alice Chen' })
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  displayName: string

  @ApiProperty({ example: 'alice@example.com' })
  @IsEmail()
  email: string

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password: string
}
