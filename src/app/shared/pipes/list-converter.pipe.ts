import { Pipe, PipeTransform } from '@angular/core';
import { ConfigService } from 'app/services/config.service';

@Pipe({
  name: 'listConverter'
})
export class ListConverterPipe implements PipeTransform {
  private configService: ConfigService;

  constructor(configService: ConfigService) {
    this.configService = configService;
  }

  transform(objectid: any): any {
    if (!objectid) {
      return '-';
    }

    this.configService.lists.subscribe(lists => {
      const item = lists.filter(listItem => listItem._id === objectid);

      if (item.length !== 0) {
        return item[0].name;
      } else {
        return '-';
      }
    });
  }
}
