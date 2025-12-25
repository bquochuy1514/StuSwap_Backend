import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import * as fs from 'fs';
import * as path from 'path';
import * as handlebars from 'handlebars';

@Injectable()
export class EmailService {
  private resend: Resend;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get('RESEND_API_KEY');
    if (apiKey) {
      this.resend = new Resend(apiKey);
    }
  }

  async sendMail(options: {
    to: string;
    subject: string;
    template: string;
    context: any;
    attachments?: any[];
  }) {
    try {
      if (!this.resend) {
        console.warn('Resend not configured, email not sent');
        return;
      }

      // Render Handlebars template thành HTML
      const html = await this.renderTemplate(options.template, options.context);

      // Gửi email qua Resend
      const result = await this.resend.emails.send({
        from: 'StudentSwap <onboarding@resend.dev>', // Email test mặc định
        to: options.to,
        subject: options.subject,
        html: html,
      });

      console.log('Email sent successfully:', result);
      return result;
    } catch (error) {
      console.error('Email send error:', error);
      // Không throw để app vẫn chạy
    }
  }

  private async renderTemplate(
    templateName: string,
    context: any,
  ): Promise<string> {
    try {
      const templatePath = path.join(
        process.cwd(),
        'src/common/templates/mail',
        templateName,
      );

      const templateContent = fs.readFileSync(templatePath, 'utf-8');
      const compiledTemplate = handlebars.compile(templateContent);

      return compiledTemplate(context);
    } catch (error) {
      console.error('Template render error:', error);
      // Fallback: trả về HTML đơn giản
      return `<h1>Email from StudentSwap</h1><p>${JSON.stringify(context)}</p>`;
    }
  }
}
