import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { SearchService } from './search.service';

@Injectable({
  providedIn: 'root'
})

export class FavoriteService {
  favorites = new BehaviorSubject<Array<any>>([]);

  constructor(
    private searchService: SearchService,
  ) {
  }

  async fetchData(fields: any[], pageNum: number = 1, pageSize: number = 10) {
    this.searchService.getSearchResults('', 'Favorite', fields, pageNum, pageSize)
      .subscribe(res => {
        this.favorites.next(res[0].data.favorites);
      })

  }

  getFavorites(): Observable<Object> {
    return this.favorites.asObservable();
  }

  isFavorite(_id: string): boolean {
    return this.favorites.value.indexOf(_id) > -1;
  }

}
