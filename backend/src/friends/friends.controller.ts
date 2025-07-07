import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { FriendsService } from './friends.service';
import { SendFriendRequestDto, HandleFriendRequestDto } from './dto/friend-request.dto';
import { GetFriendsDto } from './dto/get-friends.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('friends')
@Controller('friends')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class FriendsController {
  private readonly logger = new Logger(FriendsController.name);

  constructor(private readonly friendsService: FriendsService) {}

  @Post('request')
  @ApiOperation({ summary: 'Send friend request' })
  @ApiResponse({ status: 201, description: 'Friend request sent successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request' })
  @ApiResponse({ status: 409, description: 'Friend request already exists' })
  sendFriendRequest(@Request() req, @Body() sendFriendRequestDto: SendFriendRequestDto) {
    this.logger.log(`User ${req.user.id} sending friend request to ${sendFriendRequestDto.friendId}`);
    return this.friendsService.sendFriendRequest(req.user.id, sendFriendRequestDto);
  }

  @Get('requests')
  @ApiOperation({ summary: 'Get received friend requests' })
  @ApiResponse({ status: 200, description: 'Friend requests retrieved' })
  getFriendRequests(@Request() req) {
    this.logger.log(`Getting friend requests for user ${req.user.id}`);
    return this.friendsService.getFriendRequests(req.user.id);
  }

  @Get('requests/sent')
  @ApiOperation({ summary: 'Get sent friend requests' })
  @ApiResponse({ status: 200, description: 'Sent friend requests retrieved' })
  getSentFriendRequests(@Request() req) {
    this.logger.log(`Getting sent friend requests for user ${req.user.id}`);
    return this.friendsService.getSentFriendRequests(req.user.id);
  }

  @Patch('requests/:id')
  @ApiOperation({ summary: 'Handle friend request (accept/reject)' })
  @ApiResponse({ status: 200, description: 'Friend request handled successfully' })
  @ApiResponse({ status: 404, description: 'Friend request not found' })
  handleFriendRequest(
    @Request() req,
    @Param('id') requestId: string,
    @Body() handleDto: HandleFriendRequestDto,
  ) {
    this.logger.log(`User ${req.user.id} handling friend request ${requestId} with action ${handleDto.action}`);
    return this.friendsService.handleFriendRequest(req.user.id, requestId, handleDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get friends list' })
  @ApiResponse({ status: 200, description: 'Friends list retrieved' })
  getFriends(@Request() req, @Query() query: GetFriendsDto) {
    this.logger.log(`Getting friends for user ${req.user.id}`);
    return this.friendsService.getFriends(req.user.id, query);
  }

  @Delete(':friendId')
  @ApiOperation({ summary: 'Delete friend' })
  @ApiResponse({ status: 200, description: 'Friend deleted successfully' })
  @ApiResponse({ status: 404, description: 'Friendship not found' })
  deleteFriend(@Request() req, @Param('friendId') friendId: string) {
    this.logger.log(`User ${req.user.id} deleting friend ${friendId}`);
    return this.friendsService.deleteFriend(req.user.id, friendId);
  }
}