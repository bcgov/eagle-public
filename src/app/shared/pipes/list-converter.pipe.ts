import { Pipe, PipeTransform, inject } from '@angular/core';
import { ConfigService } from 'app/services/config.service';

@Pipe({
  name: 'listConverter',
  standalone: true
})
export class ListConverterPipe implements PipeTransform {
  private configService = inject(ConfigService);

  transform(objectid: any): any {
    if (!objectid) {
      return '-';
    }
    const item = this.configService.listItems.find((listItem: any) => listItem._id === objectid);
    return item ? item.name : objectid;
  }
}
