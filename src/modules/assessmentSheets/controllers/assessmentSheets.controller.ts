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
import { RoleUser } from '@modules/auth/role.decorator';

@Controller('assessment-sheets')
@UseGuards(AuthGuard)
export class AssessmentSheetsController {
  constructor(private readonly service: AssessmentSheetsService) {}

  @Post()
  @RoleUser('admin')
  async create(@Body() dto: CreateAssessmentSheetDto) {
    return this.service.create(dto);
  }

  @Get()
  @RoleUser('admin')
  async findAll() {
    return this.service.findAll();
  }

  @Get('client')
  @RoleUser('client')
  async findForClient(@Req() req) {
    const userId = req.user.id as string;
    return this.service.findByUserId(userId);
  }

  @Get('user/:userId')
  @RoleUser('admin')
  async findByUser(@Param('userId') userId: string) {
    return this.service.findByUserId(userId);
  }

  @Get(':id')
  @RoleUser('client')
  async findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @RoleUser('admin')
  async update(@Param('id') id: string, @Body() dto: UpdateAssessmentSheetDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @RoleUser('admin')
  async remove(@Param('id') id: string) {
    await this.service.remove(id);
    return { message: 'AssessmentSheet deleted successfully' };
  }
}
