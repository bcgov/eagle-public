import { Pipe, PipeTransform, inject } from '@angular/core';
import { ConfigService } from 'app/services/config.service';

@Pipe({
  name: 'listConverter',
  standalone: true
})
export class ListConverterPipe implements PipeTransform {
  private configService: ConfigService;

  constructor() {
    const configService = inject(ConfigService);

    this.configService = configService;
  }

  transform(objectid: any): any {
    if (!objectid) {
      return '-';
    }

    this.configService.lists.subscribe(lists => {
      const item = lists.filter((listItem: any) => listItem._id === objectid)

      if (item.length !== 0) {
        return item[0].name;
      } else {
        return '-';
      }
    });
  }
}
