import { Pipe, PipeTransform } from '@angular/core';
import { News } from 'app/models/news';

@Pipe({
  name: 'newsMultifieldFilter'
})
export class NewsMultifieldFilterPipe implements PipeTransform {
  transform(value: News[], q: string) {
    if (!q || q === '') {
      return value;
    }
    return value.filter(item => {
      let multifieldResult = false;
      if (item.project) {
        multifieldResult = multifieldResult || -1 < item.project.name.toLowerCase().indexOf(q.toLowerCase());
      }
      if (item.headline) {
        multifieldResult = multifieldResult || -1 < item.headline.toLowerCase().indexOf(q.toLowerCase());
      }
      if (multifieldResult) {
        return multifieldResult;
      }
      return -1 < 'announcement'.indexOf(q.toLowerCase());
    });
  }
}
