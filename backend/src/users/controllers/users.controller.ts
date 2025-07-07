import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Request,
  UseInterceptors,
  UploadedFile,
  Logger,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { UsersService } from '../services/users.service';
import { CreateUserDto } from '../dto/create-user.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import { SearchUsersDto } from '../dto/search-users.dto';
import { UploadAvatarDto } from '../dto/upload-avatar.dto';
import { UpdateUserSettingsDto } from '../dto/user-settings.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

interface MulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

@ApiTags('users')
@Controller('users')
export class UsersController {
  private readonly logger = new Logger(UsersController.name);

  constructor(private readonly usersService: UsersService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new user' })
  @ApiResponse({ status: 201, description: 'User created successfully' })
  @ApiResponse({ status: 409, description: 'User already exists' })
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Get('search')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Search users' })
  @ApiResponse({ status: 200, description: 'Users found' })
  search(@Query() searchDto: SearchUsersDto) {
    return this.usersService.findAll(searchDto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'User profile retrieved' })
  getProfile(@Request() req) {
    return this.usersService.findOne(req.user.id);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiResponse({ status: 200, description: 'User found' })
  @ApiResponse({ status: 404, description: 'User not found' })
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update current user profile' })
  @ApiResponse({ status: 200, description: 'User profile updated' })
  updateProfile(@Request() req, @Body() updateUserDto: UpdateUserDto) {
    this.logger.log(`Updating profile for user ${req.user.id}`);
    this.logger.log(`Request body: ${JSON.stringify(updateUserDto)}`);
    
    return this.usersService.update(req.user.id, updateUserDto);
  }

  @Post('avatar')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('avatar'))
  @ApiConsumes('multipart/form-data')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Upload user avatar' })
  @ApiResponse({ status: 200, description: 'Avatar uploaded successfully' })
  async uploadAvatar(
    @Request() req,
    @UploadedFile() file: MulterFile,
  ) {
    return this.usersService.uploadAvatar(req.user.id, file);
  }

  @Delete('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Deactivate current user account' })
  @ApiResponse({ status: 200, description: 'User account deactivated' })
  remove(@Request() req) {
    return this.usersService.remove(req.user.id);
  }

  @Get('me/settings')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user settings' })
  @ApiResponse({ status: 200, description: 'User settings retrieved' })
  getSettings(@Request() req) {
    this.logger.log(`Getting settings for user ${req.user.id}`);
    return this.usersService.getSettings(req.user.id);
  }

  @Patch('me/settings')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update user settings' })
  @ApiResponse({ status: 200, description: 'User settings updated' })
  updateSettings(@Request() req, @Body() updateSettingsDto: UpdateUserSettingsDto) {
    this.logger.log(`Updating settings for user ${req.user.id}`);
    this.logger.log(`Settings data: ${JSON.stringify(updateSettingsDto)}`);
    return this.usersService.updateSettings(req.user.id, updateSettingsDto);
  }

  @Post('me/settings/reset')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Reset user settings to default' })
  @ApiResponse({ status: 200, description: 'User settings reset' })
  resetSettings(@Request() req) {
    this.logger.log(`Resetting settings for user ${req.user.id}`);
    return this.usersService.resetSettings(req.user.id);
  }
}