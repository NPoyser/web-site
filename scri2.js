//626d8d260d921caff14e0afb1daded65

$(document).ready(function () {

const apiKey = "626d8d260d921caff14e0afb1daded65";
let currentCategory = "popular";
  let appMode = "list"; 
  let isSearchMode = false;
  let currentSearchQuery = "";

  const categoryTitles = {
    popular: "Popular Movies",
    top_rated: "Top Rated Movies",
    now_playing: "Now Playing Movies",
    upcoming: "Upcoming Movies"
  };

  let lastScroll = 0;
  let currentPage = 1;
  let totalPages = 1;
  let lastPageLoaded = 1;

  let restoreScrollPending = false;
  let loadedMovieCount = 0;
  let upcomingCachedMovies = [];

  const regions = ["US", "GB", "CA", "FR", "DE", "AU"];
  let upcomingPages = {};
  let upcomingTotalPages = {};

  const moviesPerPage = 10;
  const MAX_RESULTS = 50;
  const MAX_PAGES = 5;


  $("html, body").css({
  scrollBehavior: "auto"
  });

  function scrollTo(el) {
  $("html, body").stop().animate({
    scrollTop: $(el).offset().top
  }, 300);
}

function getActiveContainer() {
  return appMode === "grid" ? "#gridView" : "#listView";
}

$(document).on("click", ".movie-card", function () {
  lastScroll = $(window).scrollTop();
  loadMovieDetails($(this).data("id"));
  });


  //  Filter Upcoming 
function filterUpcomingMovies(movies) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return movies.filter(m => {
      const release = new Date(m.release_date);
      return !isNaN(release) && release >= tomorrow;
    });
  } 

  function resetSearchView() {
    $("#searchView").hide();
    $("#searchInput").val("");
  }


  // LOAD MOVIES
  

  function loadMovies(endpoint, page = 1) {
  currentCategory = endpoint;
  resetSearchView();
  $("#searchResults").html("")

  const scrollPos = $(window).scrollTop();
  const oldHeight = $("#collectionView").height();

  $(window).scrollTop(scrollPos);

  isSearchMode = false;

  if (endpoint === "upcoming") {
      loadUpcomingMoviesMultipleRegions(regions, page);
      return;
  }

  $.ajax({
    url: `https://api.themoviedb.org/3/movie/${endpoint}`,
    method: "GET",
    data: { api_key: apiKey, page },
    success: function (data) {
      currentPage = data.page;
      //totalPages = data.total_pages;
      totalPages = Math.min(data.total_pages, MAX_PAGES);
      lastPageLoaded = data.page;  

      const moviesToDisplay = data.results.slice(0, moviesPerPage);
      displayMovies(moviesToDisplay);
      showCategoryView();
      renderPagination(totalPages, currentPage); 
    },
    error: function () {
      $("#collectionView").html("<p>Error loading movies</p>");
    }
  });
}

  function loadMoreMovies(pageToLoad) {
    const nextPage = pageToLoad || (currentPage + 1);
    if (currentPage >= MAX_PAGES) return;
    resetSearchView();

    let url = currentCategory === "search"
      ? "https://api.themoviedb.org/3/search/movie"
      : `https://api.themoviedb.org/3/movie/${currentCategory}`;

    $.ajax({
      url: url,
      method: "GET",
      data: { api_key: apiKey, page: nextPage, query: currentSearchQuery },
      success: function (data) {
        currentPage = data.page;
        totalPages = Math.min(data.total_pages, MAX_PAGES);
        lastPageLoaded = data.page;

        if (currentCategory === "upcoming") {
          // handle upcoming separately
          return;
        }

        const moviesToShow = data.results.slice(0, moviesPerPage);
        
        appendMovies(moviesToShow);
        renderPagination(totalPages, currentPage); 
      }

    });
  }

  // UPCOMING MULTI-REGION
  function loadUpcomingMoviesMultipleRegions(regions, page = 1) {
    //$("#homeView").html("<p></p>");
    $("#collectionView").html("<p>Searching...</p>");
    $("#searchResults").html("")

    // For multi-region, reset pages only on first load
    if (page === 1) {
        regions.forEach(r => upcomingPages[r] = 1);
        regions.forEach(r => upcomingTotalPages[r] = 1);
    }

    const requests = regions.map(r =>
      $.ajax({
        url: "https://api.themoviedb.org/3/movie/upcoming",
        method: "GET",
        data: { api_key: apiKey, region: r, page: 1 }
      })
    );

    $.when(...requests).done(function(...responses) {
        let allMovies = [];
        responses.forEach((r, i) => {
            const data = r[0];
            const region = regions[i];
            upcomingTotalPages[region] = data.total_pages || 1;
            if (data.results) allMovies = allMovies.concat(data.results);
        });

        // Deduplicate by ID, keep latest release date
        const movieMap = new Map();
        allMovies.forEach(movie => {
            const release = new Date(movie.release_date);
            const existing = movieMap.get(movie.id);
            if (!existing || release > new Date(existing.release_date)) {
                movieMap.set(movie.id, movie);
            }
        });

        const dedupedMovies = Array.from(movieMap.values());
        const upcomingFiltered = filterUpcomingMovies(dedupedMovies);
        upcomingCachedMovies = upcomingFiltered.slice(0, MAX_RESULTS);

        // Calculate slice
        const limitedUpcoming = upcomingFiltered.slice(0, MAX_RESULTS);

        const moviesToShow = limitedUpcoming.slice(
            (page - 1) * moviesPerPage,
            page * moviesPerPage
        );
        displayMovies(moviesToShow);
        totalPages = MAX_PAGES;
        displayUpcomingPage(page);

        // Update currentPage
        currentPage = page;
        
    })
    .fail(() => {
        $("#collectionView").html("<p>Error loading upcoming movies.</p>");
    });
}

  // DISPLAY & APPEND MOVIES
  function displayMovies(movies) {
  $("#movieDetails").html("");

  let title = categoryTitles[currentCategory] || "Movies";
  const startIndex = (currentPage - 1) * moviesPerPage + 1;
  const endIndex = startIndex + movies.length - 1;

  const totalResults = Math.min(MAX_RESULTS, totalPages * moviesPerPage);

  //const resultText = `Showing ${startIndex}-${endIndex} of ${totalResults} results`;

  //$(".results-info").text(resultText);

  const template = $("#movie-template").html();

  let renderedMovies = "";

  movies.forEach(movie => {
    const movieData = {
      id: movie.id,
      title: movie.title,
      overview: movie.overview.substring(0, 100) + "...",
      image: movie.poster_path
        ? "https://image.tmdb.org/t/p/w300" + movie.poster_path
        : "https://placehold.co/150?text=No+Image",
      bgStyle: (appMode === "list" && movie.backdrop_path)
        ? `background-image:url(https://image.tmdb.org/t/p/w780${movie.backdrop_path});`
        : `background-image: url(https://placehold.co/780x300?text=No+Image);`,
      mode: appMode === "list" ? "list-mode" : ""
    };

    renderedMovies += Mustache.render(template, movieData);
  });

  // Title OUTSIDE grid
  if (!isSearchMode) {
  $("#collectionView").html(`
    <h2 class="category-title">${title}</h2>
  `);
  }
  const container = getActiveContainer();

  $("#collectionView").html(`
    <h2 class="category-title">${title}</h2>

    <div class="results-info">
      Showing ${startIndex}-${endIndex} of ${totalResults} results
    </div>
  `);

  $(container).html(renderedMovies);
  $("#gridView, #listView").hide();
  $(container).show();
 
}

  function appendMovies(movies) {
  const template = $("#movie-template").html();
  let rendered = "";

  movies.forEach(movie => {
    const movieData = {
      id: movie.id,
      title: movie.title,
      overview: movie.overview.substring(0, 100) + "...",
      image: movie.poster_path
        ? "https://image.tmdb.org/t/p/w300" + movie.poster_path
        : "https://placehold.co/150?text=No+Image",
      bgStyle: (appMode === "list" && movie.backdrop_path)
        ? `background-image:url(https://image.tmdb.org/t/p/w780${movie.backdrop_path});`
        : "https://placehold.co/150?text=No+Image",
      mode: appMode === "list" ? "list-mode" : ""
    };
    rendered += Mustache.render(template, movieData);

    //const rendered = Mustache.render(template, movieData);

    //const container = appMode === "grid" ? "#gridView" : "#listView";
    //$(container).append(rendered);
  });

  $(getActiveContainer()).append(rendered);
  

}


function renderPagination(total, current) {
  total = Math.min(total, MAX_PAGES);

  let paginationHtml = '';

  for (let i = 1; i <= total; i++) {
    paginationHtml += `
      <button class="page-btn ${i === current ? 'active' : ''}" data-page="${i}">
        ${i}
      </button>
    `;
  }

  $("#pagination").html(paginationHtml);
}

$(document).on("click", ".page-btn", function() {
  const page = parseInt($(this).data("page"));
  currentPage = page;

  if (isSearchMode) {
    searchMovies(currentSearchQuery, page);

    requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      $("html, body").stop(true).animate({
        scrollTop: $(isSearchMode ? "#searchResults" : "#collectionView").offset().top
      }, 350);
    });
    });
  } else if (currentCategory === "upcoming") {
    displayUpcomingPage(page);

    $("html, body").stop(true).animate({
      scrollTop: $(currentCategory === "search" ? "#searchResults" : "#collectionView").offset().top
    }, 350);
  } else {
    loadMovies(currentCategory, page);
    
    requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      $("html, body").stop(true).animate({
        scrollTop: $(currentCategory === "search" ? "#searchResults" : "#collectionView").offset().top
      }, 350);
    });
    });
    
  }

});

function displayUpcomingPage(page) {
    currentPage = page;

    const start = (page - 1) * moviesPerPage;
    const end = page * moviesPerPage;

    const moviesToShow = upcomingCachedMovies.slice(start, end);

    displayMovies(moviesToShow);

    renderPagination(MAX_PAGES, page);
}

  


//  Reset Search 
function resetSearchView() {
  $("#searchView").hide();
  $("#searchInput").val("");
}



function loadMovieDetails(movieId) {
  $("#movieDetails").html("<p>Loading details...</p>");
  
  //resetSearchView();

  // Fetch movie details
  $.ajax({
    url: `https://api.themoviedb.org/3/movie/${movieId}`,
    method: "GET",
    data: {
      api_key: apiKey,
      append_to_response: "credits" // this loads cast
    },
    success: function (data) {
      displayMovieDetails(data);
    },
    error: function () {
      $("#movieDetails").html("<p>Error loading movie details</p>");
    }
  });
}



function displayMovieDetails(movie) {
  const template = $("#movie-details-template").html();

  const movieData = {
    title: movie.title,
    overview: movie.overview,
    release_date: movie.release_date,
    vote_average: movie.vote_average,
    image: movie.poster_path
      ? "https://image.tmdb.org/t/p/w300" + movie.poster_path
      : "https://placehold.co/150?text=No+Image",
    backdrop: movie.backdrop_path
    ? "https://image.tmdb.org/t/p/original" + movie.backdrop_path
    : ""
  };



  const rendered = Mustache.render(template, movieData);

  $("#movieDetails").html(rendered);

  if (movie.credits) {
    const castCrewHtml = renderCastCrew(movie.credits);
    $("#movieDetails").append(castCrewHtml);
  }

  $("#movieDetails").show();
  goToMovieDetails();
}







function goToMovieDetails() {
  requestAnimationFrame(() => {
    const el = $("#movieDetails");
    if (!el.length) return;

    const navbarHeight = $(".navbar").outerHeight() || 0;
    const extraPadding = 20;


    $("html, body").stop(true).animate({
      scrollTop: el.offset().top - navbarHeight - extraPadding
    }, 400);
  });
}





function renderCastCrew(credits) {
  // Set how many initially visible
  const initialCount = 5;

  // Cast
  let html = "";
    html += `
    <div class="cast-section">
      <h3>Cast (${credits.cast.length})</h3>
      <div class="person-row cast-row">
    `;  
  
    credits.cast.forEach((actor, index) => {
    const imgUrl = actor.profile_path
      ? "https://image.tmdb.org/t/p/w185" + actor.profile_path
      : "https://placehold.co/150?text=No+Image";
    const hiddenClass = index >= initialCount ? 'hidden-person' : '';
    html += `
      <div class="person-card ${hiddenClass}">
        <img src="${imgUrl}" alt="${actor.name}">
        <p>${actor.name}</p>
        ${actor.character ? `<p style="font-size:0.7rem;color:#ccc;">plays ${actor.character}</p>` : ""}
      </div>
    `;
  });
  html += `
      </div>
      ${credits.cast.length > initialCount ? '<button class="view-more-btn" data-target="cast">View More</button>' : ""}
    </div>
  `;


  // Crew
    html += `
    <div class="crew-section">
      <h3>Crew (${credits.crew.length})</h3>
      <div class="person-row crew-row">
    `;  
    credits.crew.forEach((member, index) => {
    const imgUrl = member.profile_path
      ? "https://image.tmdb.org/t/p/w185" + member.profile_path
      : "https://placehold.co/150?text=No+Image";
    const hiddenClass = index >= initialCount ? 'hidden-person' : '';
    html += `
      <div class="person-card ${hiddenClass}">
        <img src="${imgUrl}" alt="${member.name}">
        <p>${member.name}</p>
        <p style="font-size:0.7rem;color:#ccc;">${member.job}</p>
      </div>
    `;
  });
  html += `
      </div>
      ${credits.crew.length > initialCount ? '<button class="view-more-btn" data-target="crew">View More</button>' : ""}
    </div>
  `;

  return html;
}





// Handle view more clicks
$(document).on('click', '.view-more-btn', function() {
  const btn = $(this);
  const rowDiv = btn.prev('.person-row'); // only toggle the previous row
  rowDiv.find('.hidden-person').slideToggle(); // toggle hidden cards
  // Swap button text correctly
  if (btn.text() === "View More") {
    btn.text("View Less");
  } else {
    btn.text("View More");
  }
});




// Search


function showCategoryView() {
  $("#searchResults").hide();
  $("#collectionView").show();

  $(getActiveContainer()).show();
  $("#gridView, #listView").not(getActiveContainer()).hide();
}

function showSearchView() {
  $("#collectionView").hide();
  $("#gridView").hide();
  $("#listView").hide();
  $("#searchResults").show();
  $("#movieDetails").hide();
}



function displaySearchMovies(movies) {
  const startIndex = (currentPage - 1) * moviesPerPage + 1;
  const endIndex = startIndex + movies.length - 1;
  const totalResults = Math.min(MAX_RESULTS, totalPages * moviesPerPage);
  const scrollPos = $(window).scrollTop();
  const oldHeight = $("#searchResults").height();
  $("#searchResults").html(`<div style="height:${oldHeight}px"></div>`);
  $(window).scrollTop(scrollPos);

  const template = $("#movie-template").html();
  let rendered = "";

  movies.forEach(movie => {
    const movieData = {
      id: movie.id,
      title: movie.title,
      overview: movie.overview.substring(0, 100) + "...",
      image: movie.poster_path
        ? "https://image.tmdb.org/t/p/w300" + movie.poster_path
        : "https://placehold.co/150?text=No+Image",
      bgStyle: (appMode === "list" && movie.backdrop_path)
        ? `background-image:url(https://image.tmdb.org/t/p/w780${movie.backdrop_path});`
        : `background-image: url(https://placehold.co/780x300?text=No+Image);`,
      mode: appMode === "list" ? "list-mode" : ""
    };

    rendered += Mustache.render(template, movieData);
  });

  const container =
    appMode === "grid"
      ? `<div class="movie-grid">`
      : `<div class="movie-list">`;

  
  $("#searchResults").html(`
    <h2 class="category-title">
      Displaying results for "${currentSearchQuery}"
    </h2>

    <div class="results-info">
      Showing ${startIndex}-${endIndex} of ${totalResults} results
    </div>

    ${container}
      ${rendered}
    </div>
  `);
}

function searchMovies(query, page = 1) {

  const scrollPos = $(window).scrollTop();
  const oldHeight = $("#searchResults").height();
  $("#searchResults").html(`<div style="height:${oldHeight}px"></div>`);
  $(window).scrollTop(scrollPos);
  
  //resetSearchView();

  isSearchMode = true;
  currentSearchQuery = query;
  currentPage = page;

  $("#searchResults").html(`
    <h2 class="category-title">
      Searching for "${query}"...
    </h2>
  `);

  $.ajax({
    url: "https://api.themoviedb.org/3/search/movie",
    method: "GET",
    data: {
      api_key: apiKey,
      query: query,
      page: page
    },
    success: function(data) {
      totalPages = Math.min(data.total_pages, MAX_PAGES);

      showSearchView();

      displaySearchMovies(data.results.slice(0, moviesPerPage));
      renderPagination(totalPages, currentPage);

      
    },
    error: function() {
      $("#searchResults").html("<p>Error searching movies.</p>");
    }
  });
}




$("#searchForm").on("submit", function(e) {
  e.preventDefault();

  const query = $("#searchInput").val().trim();

  if (!query) return;

  searchMovies(query);


  $("html, body").animate({
    scrollTop: $("#searchResults").offset().top - 70
  }, 300);
});



  //  Dropdown  

  function handleCategoryChange(category) {
  if (!category) return;
  currentCategory = category;
  loadMovies(category);
}

//  Select dropdown 
$("#categorySelect").change(function () {
  const selected = $(this).val();
  handleCategoryChange(selected);
});

//  Dropdown links 
$(document).on("click", ".dropdown-content a", function (e) {
  e.preventDefault();
  const category = $(this).data("category");
  handleCategoryChange(category);
});


const dropdown = document.querySelector(".dropdown");
const menu = dropdown.querySelector(".dropdown-content");
let hideTimeout;

dropdown.addEventListener("mouseenter", () => {
  clearTimeout(hideTimeout);          // cancel any hide delay
  menu.style.visibility = "visible";
  menu.style.opacity = "1";
  menu.style.pointerEvents = "auto";  // enable clicks
});

dropdown.addEventListener("mouseleave", () => {
  // Add a small delay to prevent flicker when moving fast
  hideTimeout = setTimeout(() => {
    menu.style.opacity = "0";
    menu.style.pointerEvents = "none";
    setTimeout(() => {
      menu.style.visibility = "hidden";
    }, 200); // matches transition
  }, 150); // delay before hiding
});




function closeMovieDetails() {
  $("#movieDetails").html("");

  if (isSearchMode) {
    showSearchView();
  } else {
    showCategoryView();
  }
}



$(document).on('click', '#backBtn', function() {

    closeMovieDetails();

    $("#categorySelect").val(currentCategory);

    if (isSearchMode) {

        searchMovies(currentSearchQuery, currentPage);


        let neededPages = Math.ceil(loadedMovieCount / 20);

        for (let i = 2; i <= neededPages; i++) {
            loadMoreMovies(i);
        }

    }

    else if (currentCategory === "upcoming") {
      displayUpcomingPage(currentPage);

    }

    else {

        loadMovies(currentCategory, lastPageLoaded);
        setTimeout(() => {
        $("html, body").stop().animate({
          scrollTop: lastScroll
        }, 400);
        }, 300);

    }

    requestAnimationFrame(() => {
    $("html, body").stop(true).animate({
      scrollTop: lastScroll
    }, 300);
    });
});



$("#homeBtn").click(function () {
  $("#searchView").hide();
  $("#searchResults").html(""); // clear search
  loadMovies("popular");
});


$("#searchBtn").click(function () {
  $("#searchView").slideToggle();


  $("html, body").animate({
    scrollTop: 0
  }, 400)
}); 




$("#back-arrow").on("click", function () {
  window.location.href = "Projects.html";
});




function hideMovieDetails() {
  $("#movieDetails").hide().html("");
}


$("#gridViewBtn").click(function () {
  appMode = "grid";

  hideMovieDetails();
  if (isSearchMode) {
    searchMovies(currentSearchQuery, currentPage);
  } else {
    loadMovies(currentCategory, currentPage);
  }
});

$("#listViewBtn").click(function () {
  appMode = "list";

  hideMovieDetails();
  if (isSearchMode) {
    searchMovies(currentSearchQuery, currentPage);
  } else {
    loadMovies(currentCategory, currentPage);
  }
});







function initView() {
  if (appMode === "grid") {
    $("#gridView").show();
    $("#listView").hide();
  } else {
    $("#listView").show();
    $("#gridView").hide();
  }
}


  //  Initial Load 
  loadMovies(currentCategory);

});