import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ListEventsWindowComponent } from './list-events-window.component';

describe('ListEventsWindowComponent', () => {
  let component: ListEventsWindowComponent;
  let fixture: ComponentFixture<ListEventsWindowComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ListEventsWindowComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(ListEventsWindowComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
