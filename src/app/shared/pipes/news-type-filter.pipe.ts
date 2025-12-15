import { Pipe, PipeTransform } from '@angular/core';
import {News} from 'app/models/news';

@Pipe({
  name: 'newsTypeFilter'
})
export class NewsTypeFilterPipe implements PipeTransform {

    transform(value: News[], q: string) {
        if (!q || q === '') {
            return value;
        }
        return value.filter(item => -1 < item.type.toLowerCase().indexOf(q.toLowerCase()));
    }
}
