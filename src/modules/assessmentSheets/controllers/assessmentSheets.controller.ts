import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AssessmentSheetsService } from '../services/assessmentSheets.service';
import { CreateAssessmentSheetDto, UpdateAssessmentSheetDto } from '../dtos/assessmentSheetDto';
import { AuthGuard } from '@modules/auth/providers/auth.guard';
import type { AuthUser } from '@modules/auth/providers/auth.guard';
import { RoleUser } from '@modules/auth/role.decorator';

type AuthenticatedRequest = { user: AuthUser };

@Controller('assessment-sheets')
@UseGuards(AuthGuard)
export class AssessmentSheetsController {
  constructor(private readonly service: AssessmentSheetsService) {}

  @Post()
  @RoleUser('admin')
  async create(@Body() dto: CreateAssessmentSheetDto, @Req() req: AuthenticatedRequest) {
    return this.service.create(dto, req.user);
  }

  @Get()
  @RoleUser('admin')
  async findAll(@Req() req: AuthenticatedRequest) {
    return this.service.findAll(req.user);
  }

  @Get('client')
  @RoleUser('client')
  async findForClient(@Req() req: AuthenticatedRequest) {
    return this.service.findForUser(req.user.id, req.user);
  }

  @Get('user/:userId')
  @RoleUser('admin')
  async findByUser(@Param('userId') userId: string, @Req() req: AuthenticatedRequest) {
    return this.service.findForUser(userId, req.user);
  }

  @Get(':id')
  @RoleUser('client')
  async findOne(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.service.findOne(id, req.user);
  }

  @Patch(':id')
  @RoleUser('admin')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateAssessmentSheetDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.update(id, dto, req.user);
  }

  @Delete(':id')
  @RoleUser('admin')
  async remove(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    await this.service.remove(id, req.user);
    return { message: 'AssessmentSheet deleted successfully' };
  }
}
