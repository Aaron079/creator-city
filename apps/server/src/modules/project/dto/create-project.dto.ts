import { IsString, IsEnum, IsOptional, IsArray, MinLength, MaxLength } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

enum ProjectTypeEnum {
  SHORT_FILM = 'SHORT_FILM',
  FEATURE_FILM = 'FEATURE_FILM',
  WEB_SERIES = 'WEB_SERIES',
  DOCUMENTARY = 'DOCUMENTARY',
  ANIMATION = 'ANIMATION',
  MUSIC_VIDEO = 'MUSIC_VIDEO',
  COMMERCIAL = 'COMMERCIAL',
  INTERACTIVE = 'INTERACTIVE',
}

enum ProjectVisibilityEnum {
  PRIVATE = 'PRIVATE',
  COLLABORATORS = 'COLLABORATORS',
  PUBLIC = 'PUBLIC',
}

export class CreateProjectDto {
  @ApiProperty({ example: 'The Last Signal' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  title: string

  @ApiProperty({ example: 'A sci-fi short film about first contact.' })
  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  description: string

  @ApiProperty({ enum: ProjectTypeEnum })
  @IsEnum(ProjectTypeEnum)
  type: string

  @ApiProperty({ enum: ProjectVisibilityEnum, required: false })
  @IsOptional()
  @IsEnum(ProjectVisibilityEnum)
  visibility?: string

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[]

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  genre?: string[]
}
